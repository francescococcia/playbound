// AI co-designer. One framework-free handler used by BOTH the Vite dev server
// (server/aiDevPlugin.ts) and the Vercel function (api/ai/[action].ts).
//
//   GET  health   -> { ai, model }
//   POST sketch   { image | text } -> Proposal(replaceAll)   layout from a drawing or a description
//   POST style    { image | text } -> Proposal(styleNotes)   style from a picture or a description
//   POST command  { text, level }  -> Proposal(add/update/remove)
//   POST fix      { level }        -> Proposal(add cover) that PASSES Prove (agent loop)
//
// Rule: the AI only proposes. Every proposal is validated here (clamped to the level,
// unique ids, one spawn/objective) and previewed with our real Prove before the designer
// sees it. Nothing is applied until they click Accept.
import { isSolid } from "../../src/core/geometry.js";
import { boundsForWidth, isInside, overlaps, placeAll, placeClear } from "../../src/core/layout.js";
import { prove } from "../../src/core/prove/prove.js";
import type { AgentRequest, AgentResponse, AiResponse, CommandRequest, FixRequest, SketchRequest, StyleRequest } from "../../src/core/ai/types.js";
import { agent } from "./agent.js";
import type { Level, Proposal, ProveResult, Role, Volume } from "../../src/core/types.js";
import { GEMINI_MODELS, geminiJson } from "./gemini.js";

const ROLES: Role[] = ["spawn", "objective", "cover", "block", "landmark", "prop"];
const MAX_PER_IP = 30; // per 10 minutes
const MAX_PER_DAY = 400; // per server instance (protects the free quota during judging)

export interface AiResult {
  status: number;
  body: AiResponse | AgentResponse | { ai: boolean; model?: string };
}

export async function handleAi(action: string, method: string, body: unknown, apiKey: string | undefined, ip = "local"): Promise<AiResult> {
  if (action === "health") return { status: 200, body: { ai: !!apiKey, model: apiKey ? GEMINI_MODELS[0] : undefined } };
  if (!apiKey) return { status: 503, body: { error: "AI is not configured (missing GEMINI_API_KEY)." } };
  if (method !== "POST") return { status: 405, body: { error: "Use POST" } };
  const limited = rateLimit(ip);
  if (limited) return { status: 429, body: { error: limited } };

  try {
    switch (action) {
      case "sketch":
        return ok(await sketch(apiKey, body as SketchRequest));
      case "style":
        return ok(await style(apiKey, body as StyleRequest));
      case "command":
        return ok(await command(apiKey, body as CommandRequest));
      case "fix":
        return ok(await fix(apiKey, body as FixRequest));
      case "agent":
        return { status: 200, body: await agent(apiKey, body as AgentRequest) };
      default:
        return { status: 404, body: { error: `Unknown AI action "${action}"` } };
    }
  } catch (e) {
    return { status: 502, body: { error: e instanceof Error ? e.message : String(e) } };
  }
}

const ok = (body: AiResponse): AiResult => ({ status: 200, body });

// ---------- sketch: drawing -> greybox ----------

/** Coordinate rules for a map of the given side in metres (40, 60, 80 or 120), or "areaMeters" when the model picks it. */
export const volumeRules = (side: number | "areaMeters" = 40) => `Coordinates: the play area is a square of ${side} m x ${side} m centred at (0,0)${typeof side === "number" ? ` (x and z from -${side / 2} to ${side / 2})` : ""}; every box must fit fully inside it and must not overlap another box. +X = east (right), +Z = south (down in a top-down image), Y up.
position = centre of the box's BOTTOM face [x, 0, z] in meters; size = [width X, height Y, depth Z] in meters; rotationY in DEGREES (usually 0).
Roles: "spawn" (player start, exactly one), "objective" (goal, exactly one), "block" (buildings, walls), "landmark" (tall, visible from far: towers, statues), "cover" (chest-high objects players hide behind: carts, low walls, crates), "prop" (other small set dressing).
Estimate real-world heights (house 6-8 m, stall 2.5 m, cart 1.2 m). Labels are short real-world descriptions (e.g. "timber-framed tavern"), never generic ("box").`;
export const VOLUME_RULES = volumeRules(40);

export const VOLUME_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    role: { type: "string", enum: ROLES },
    position: { type: "array", items: { type: "number" } },
    rotationY: { type: "number" },
    size: { type: "array", items: { type: "number" } },
  },
  required: ["label", "role", "position", "size"],
};

export async function sketch(key: string, req: SketchRequest): Promise<AiResponse> {
  const text = req?.text?.trim().slice(0, 800);
  if (!req?.image && !text) throw new Error("No image or description");
  const sizing = `First decide "areaMeters", the real width of the area: for a map or screenshot, estimate it from street widths and building sizes (a typical town square is 50-70 m, a large building 60-90 m long); for a hand sketch with no scale use 40. Allowed: 40, 60, 80 or 120. Then place every box at REAL scale in a square of areaMeters x areaMeters centred at (0,0).
Also give the level a short "name" (2-4 words, e.g. "Cambridge Market Square").
Also write "styleNotes": art direction for the 3D models (max 30 words, comma-separated, no full sentences): if this is a map or picture of a REAL, recognisable place, describe that place's real architecture (era, materials, colours, roofs; realistic, not fantasy or medieval unless the place really is); otherwise describe a look that fits what is drawn.`;
  const prompt = req.image
    ? `You turn a top-down level sketch (or map, or screenshot) into a greybox level for a first-person game.
The drawn outer border (or the image edge) is the edge of the play area. ${volumeRules("areaMeters")}
${sizing}
Include every drawn building and object. If the start or goal is not marked, choose sensible places.${text ? `
Designer's notes (follow them; they win over your own choices, especially where the start/spawn and goal/objective go): "${text}"` : ""}
Return JSON: {"name", "areaMeters", "styleNotes", "why": "one sentence describing the layout you read", "volumes": [...]}`
    : `You design a greybox level for a first-person stealth game from the designer's description.
${volumeRules(40)}
Use areaMeters 40 unless the designer asks for a bigger or larger map (then 60, 80 or 120, with coordinates spread to fill it).
Description: "${text}"
Make 8-16 boxes (up to 24 on a bigger map): one spawn and one objective at least 20 m apart, buildings that shape streets and sightlines, a few landmarks, and some chest-high cover. Leave a walkable route (at least 2 m wide) from spawn to objective. It does not have to be perfect: the designer will Prove it and fix it.
Also give the level a short "name" (2-4 words).
Also write "styleNotes": art direction for the 3D models (max 30 words, comma-separated, no full sentences): if this is a description of a REAL, recognisable place, describe that place's real architecture (era, materials, colours, roofs; realistic, not fantasy or medieval unless the place really is); otherwise describe a look that fits what is drawn.
Return JSON: {"name", "areaMeters", "styleNotes", "why": "one sentence describing the layout", "volumes": [...]}`;
  const { data, model } = await geminiJson<{ name?: string; areaMeters?: number; styleNotes?: string; why?: string; volumes?: unknown[] }>(key, prompt, {
    image: req.image,
    schema: {
      type: "object",
      properties: { name: { type: "string" }, areaMeters: { type: "number" }, styleNotes: { type: "string" }, why: { type: "string" }, volumes: { type: "array", items: VOLUME_SCHEMA } },
      required: ["volumes"],
    },
  });
  const bounds = boundsForWidth(Number(data.areaMeters) || 40);
  const { placed, dropped } = placeAll(cleanVolumes(data.volumes ?? [], bounds, new Set()), [], bounds);
  const volumes = ensureMarkers(placed, bounds);
  if (volumes.length < 2) throw new Error(req.image ? "Could not read a layout from that image" : "Could not build a layout from that description");
  const levelName = String(data.name ?? "").trim().slice(0, 40) || undefined;
  // The new layout brings its own look: the previous level's style notes must not carry over.
  const styleNotes = String(data.styleNotes ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
  const level: Level = { id: "preview", name: "preview", bounds, locked: false, volumes };
  const base = data.why ?? (req.image ? `Greybox from your sketch: ${volumes.length} boxes.` : `Greybox from your description: ${volumes.length} boxes.`);
  const why = `${base} Map ${bounds * 2} m.${dropped.length ? ` Left out ${dropped.length} overlapping box${dropped.length > 1 ? "es" : ""}.` : ""}`;
  // The image covers areaMeters (real scale); the client lays it on the floor under the boxes.
  const area = Math.min(300, Math.max(20, Number(data.areaMeters) || bounds * 2));
  const ground = req.image ? { imageUrl: "", width: area, depth: area } : undefined;
  return { model, proposal: { id: pid("sketch"), source: "sketch", why, replaceAll: true, add: volumes, levelName, bounds, styleNotes, ground, previewProve: prove(level) } };
}

// ---------- style: picture -> style notes ----------

export async function style(key: string, req: StyleRequest): Promise<AiResponse> {
  const text = req?.text?.trim().slice(0, 800);
  if (!req?.image && !text) throw new Error("No image or description");
  const prompt = `You are an art director. Describe the visual style ${req.image ? "of this reference image" : `that fits this level: "${text}"`} as notes that will be prepended to text-to-3D prompts for game props.
Cover: setting/era, materials, colour palette, level of stylisation (e.g. hand-painted, realistic, low-poly), mood. Max 30 words, comma-separated, no full sentences, no mention of "image".
Return JSON: {"styleNotes": "...", "why": "one short sentence on ${req.image ? "what you saw" : "the look you chose"}"}`;
  const { data, model } = await geminiJson<{ styleNotes?: string; why?: string }>(key, prompt, {
    image: req.image,
    schema: { type: "object", properties: { styleNotes: { type: "string" }, why: { type: "string" } }, required: ["styleNotes"] },
  });
  const styleNotes = (data.styleNotes ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!styleNotes) throw new Error(req.image ? "Could not read a style from that image" : "Could not write a style for that description");
  return { model, proposal: { id: pid("style"), source: "style", why: data.why ?? (req.image ? "Style read from your reference image." : "Style written from your description."), styleNotes } };
}

// ---------- command: text -> edits ----------

async function command(key: string, req: CommandRequest): Promise<AiResponse> {
  const level = req?.level;
  const text = (req?.text ?? "").trim().slice(0, 500);
  if (!level || !text) throw new Error("Need a level and a request");
  if (level.locked) return { note: "The layout is locked. Unlock it to change boxes." };
  const prompt = `You edit a greybox game level on request. ${VOLUME_RULES}
Current boxes: ${JSON.stringify(level.volumes.map((v) => ({ id: v.id, label: v.label, role: v.role, position: v.position.map(r1), size: v.size, rotationY: Math.round((v.rotationY * 180) / Math.PI) })))}
Request: "${text}"
Make the smallest change that satisfies the request. Do not overlap existing solid boxes. Keep the route from spawn to objective walkable.
Return JSON: {"why": "one sentence for the designer", "add": [new boxes], "update": [{"id", "position"?, "size"?, "rotationY"?}], "remove": [ids]}`;
  const { data, model } = await geminiJson<{ why?: string; add?: unknown[]; update?: unknown[]; remove?: unknown[] }>(key, prompt, {
    schema: {
      type: "object",
      properties: {
        why: { type: "string" },
        add: { type: "array", items: VOLUME_SCHEMA },
        update: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" }, position: { type: "array", items: { type: "number" } }, size: { type: "array", items: { type: "number" } }, rotationY: { type: "number" } },
            required: ["id"],
          },
        },
        remove: { type: "array", items: { type: "string" } },
      },
      required: ["why"],
    },
  });
  const p = buildEditProposal(level, data, "text", text);
  return p ? { model, proposal: p } : { model, note: data.why ?? "No change needed." };
}

/**
 * Validate a model-drafted edit against the level (existing ids only, clamped positions and
 * sizes, unique new ids) and preview it with Prove. Returns null if nothing valid remains.
 */
export function buildEditProposal(level: Level, raw: Record<string, unknown>, source: Proposal["source"], fallbackWhy = "Suggested change"): Proposal | null {
  const ids = new Set(level.volumes.map((v) => v.id));
  const add = cleanVolumes((raw.add as unknown[]) ?? [], level.bounds, new Set(ids));
  const update = ((raw.update as unknown[]) ?? [])
    .map((u) => u as { id?: string; position?: unknown; size?: unknown; rotationY?: unknown })
    .filter((u) => u.id && ids.has(u.id))
    .map((u) => ({
      id: u.id!,
      ...(vec3(u.position) && { position: clampPos(vec3(u.position)!, level.bounds) }),
      ...(vec3(u.size) && { size: clampSize(vec3(u.size)!) }),
      ...(typeof u.rotationY === "number" && { rotationY: deg(u.rotationY) }),
    }));
  const remove = ((raw.remove as unknown[]) ?? []).filter((id): id is string => typeof id === "string" && ids.has(id));
  // Moved / resized boxes stay inside the map and clear of the others (else the change is skipped).
  const kept = level.volumes.filter((v) => !remove.includes(v.id));
  const moved = update.flatMap((u) => {
    const v = kept.find((x) => x.id === u.id)!;
    const next = placeClear({ ...v, ...u }, kept.filter((x) => x.id !== v.id), level.bounds);
    return next ? [{ ...u, position: next.position, size: next.size }] : [];
  });
  update.splice(0, update.length, ...moved);
  const after = kept.map((v) => ({ ...v, ...update.find((u) => u.id === v.id) }));
  const fitted = placeAll(add, after, level.bounds).placed;
  add.splice(0, add.length, ...fitted);
  if (!add.length && !update.length && !remove.length) return null;
  const said = typeof raw.why === "string" && raw.why.trim() ? raw.why.trim() : fallbackWhy;
  // Append what the proposal ACTUALLY does, so the text can't promise more than the change.
  const label = (id: string) => level.volumes.find((v) => v.id === id)?.label ?? id;
  const did = [
    ...add.map((v) => `adds ${v.label}`),
    ...update.map((u) => `${u.position ? "moves" : "resizes"} ${label(u.id)}`),
    ...remove.map((id) => `removes ${label(id)}`),
  ];
  const why = `${said} (Changes: ${did.join(", ")}.)`;
  const p: Proposal = { id: pid(source === "text" ? "cmd" : source), source, why, add, update, remove };
  return { ...p, previewProve: prove(applyPreview(level, p)) };
}

// ---------- fix: agent loop until Prove passes ----------

interface Candidate {
  x: number;
  z: number;
  rotationY?: number;
  label?: string;
}

export async function fix(key: string, req: FixRequest): Promise<AiResponse> {
  const level = req?.level;
  if (!level) throw new Error("Need a level");
  if (level.locked) return { note: "The layout is locked. Unlock it to add cover." };
  const now = prove(level);
  if (now.status === "pass") return { note: "This level already passes Prove." };
  if (now.reason === "NO_PATH") return { note: "There is no route at all: remove or move a blocking box first (adding cover won't help)." };

  const exposed = longestExposedStretch(now);
  const solids = level.volumes.filter(isSolid).map((v) => ({ label: v.label, centre: [r1(v.position[0]), r1(v.position[2])], size: [v.size[0], v.size[2]] }));
  const tried: { at: number[]; result: string }[] = [];
  let best: { c: Candidate; r: ProveResult } | undefined;
  let model = GEMINI_MODELS[0];
  let why = "";

  // Agent loop (max 2 rounds): the model proposes spots, our Prove verifies each, failures are fed back.
  for (let round = 0; round < 2 && !best; round++) {
    const prompt = `Level fails Prove: "${now.message}" (passes when >= 25% of the route is protected: out of the objective's line of sight, or within 2.5 m of chest-high cover).
Exposed route points (x,z): ${JSON.stringify(exposed)}. Solid boxes (do not overlap): ${JSON.stringify(solids)}.
${tried.length ? `Already tried, FAILED: ${JSON.stringify(tried)}. Pick different spots closer to the exposed points.` : ""}
Propose 4 positions for a 1.2 x 2.5 m chest-high cover object, 1-2 m to the side of the exposed route (never on it). rotationY in degrees. Label = a real object that fits this place: ${level.styleNotes ? `"${level.styleNotes}"` : `a level with ${level.volumes.slice(0, 8).map((v) => v.label).join(", ")}`}.
Return JSON: {"candidates": [{"x", "z", "rotationY", "label"}], "why": "one sentence for the designer"}`;
    let res;
    try {
      res = await geminiJson<{ candidates?: Candidate[]; why?: string }>(key, prompt, { fast: true, timeoutMs: 30_000 });
    } catch {
      break; // AI down or slow: fall through to the search below
    }
    model = res.model;
    why = res.data.why ?? why;
    for (const raw of (res.data.candidates ?? []).slice(0, 6)) {
      const c = { ...raw, rotationY: deg(Number(raw.rotationY) || 0) };
      const r = tryCover(level, c);
      tried.push({ at: [r1(c.x), r1(c.z)], result: r ? `${r.status} ${Math.round((r.coveredFraction ?? 0) * 100)}%` : "overlaps a box" });
      if (r?.status === "pass" && (!best || (r.coveredFraction ?? 0) > (best.r.coveredFraction ?? 0))) best = { c, r };
    }
  }
  if (best) {
    return { model, proposal: coverProposal(best.c, best.r, `${why || "Cover beside the exposed stretch."} Route now ${Math.round((best.r.coveredFraction ?? 0) * 100)}% covered (checked by Prove).`) };
  }

  // Fallback: systematic search beside the exposed stretch (still verified by Prove).
  const found = searchCover(level, now);
  if (found) {
    return { model: `${model} + search`, proposal: coverProposal(found.c, found.r, `A cart beside the exposed stretch makes the route ${Math.round((found.r.coveredFraction ?? 0) * 100)}% covered.`) };
  }
  return { model, note: "No single cover box fixes this route. Try adding a second one, or shorten the open stretch." };
}

function coverProposal(c: Candidate, r: ProveResult, why: string): Proposal {
  const label = (c.label ?? "wooden market cart").slice(0, 60);
  return {
    id: pid("fix"),
    source: "fix",
    why,
    add: [{ id: label, label, role: "cover", position: [r1(c.x), 0, r1(c.z)], rotationY: c.rotationY ?? 0, size: [1.2, 1.2, 2.5] }],
    previewProve: r,
  };
}

/** Prove with one extra cover box; null if it overlaps a solid or leaves the play area. */
function tryCover(level: Level, c: Candidate): ProveResult | null {
  if (![c.x, c.z].every(Number.isFinite)) return null;
  const box: Volume = { id: "ai-cover", label: "cover", role: "cover", position: [c.x, 0, c.z], rotationY: c.rotationY ?? 0, size: [1.2, 1.2, 2.5] };
  if (!isInside(box, level.bounds - 0.5) || level.volumes.some((v) => (isSolid(v) || v.role === "spawn" || v.role === "objective") && overlaps(box, v, 0.3))) return null;
  const r = prove({ ...level, volumes: [...level.volumes, box] });
  return r.reason === "NO_PATH" ? null : r;
}

function searchCover(level: Level, now: ProveResult): { c: Candidate; r: ProveResult } | undefined {
  const path = now.path ?? [];
  let best: { c: Candidate; r: ProveResult } | undefined;
  for (let i = 2; i < path.length - 2; i += 3) {
    if (now.covered?.[i]) continue;
    const [x0, , z0] = path[i - 2];
    const [x1, , z1] = path[i + 2];
    const len = Math.hypot(x1 - x0, z1 - z0) || 1;
    const nx = -(z1 - z0) / len;
    const nz = (x1 - x0) / len;
    const rotationY = Math.atan2(x1 - x0, z1 - z0); // long side along the route
    for (const off of [1.6, -1.6, 2.2, -2.2]) {
      const c = { x: path[i][0] + nx * off, z: path[i][2] + nz * off, rotationY };
      const r = tryCover(level, c);
      if (r?.status === "pass" && (!best || (r.coveredFraction ?? 0) > (best.r.coveredFraction ?? 0))) best = { c, r };
    }
  }
  return best;
}

export function longestExposedStretch(r: ProveResult): number[][] {
  const path = r.path ?? [];
  let bestS = 0;
  let bestE = -1;
  let s = -1;
  for (let i = 0; i <= path.length; i++) {
    const exposed = i < path.length && !r.covered?.[i];
    if (exposed && s < 0) s = i;
    if (!exposed && s >= 0) {
      if (i - s > bestE - bestS) [bestS, bestE] = [s, i];
      s = -1;
    }
  }
  return path.slice(bestS, bestE).filter((_, i) => i % 4 === 0).map((p) => [r1(p[0]), r1(p[2])]);
}

// ---------- validation helpers ----------

function cleanVolumes(raw: unknown[], bounds: number, taken: Set<string>): Volume[] {
  const out: Volume[] = [];
  for (const item of raw.slice(0, 60)) {
    const v = item as Partial<Volume> & { position?: unknown; size?: unknown };
    const role = ROLES.includes(v.role as Role) ? (v.role as Role) : "prop";
    const pos = vec3(v.position);
    const size = vec3(v.size);
    if (!pos || !size) continue;
    const label = String(v.label ?? role).trim().slice(0, 80) || role;
    const id = uniqueId(String(v.id ?? label), taken);
    taken.add(id);
    out.push({ id, label, role, position: clampPos(pos, bounds), rotationY: Number.isFinite(v.rotationY) ? deg(v.rotationY as number) : 0, size: role === "spawn" ? [2, 0.1, 2] : clampSize(size) });
  }
  return out;
}

/** Exactly one spawn and one objective (keep the first; add defaults if missing). */
function ensureMarkers(vs: Volume[], bounds: number): Volume[] {
  const out: Volume[] = [];
  const seen = new Set<Role>();
  for (const v of vs) {
    if ((v.role === "spawn" || v.role === "objective") && seen.has(v.role)) continue;
    seen.add(v.role);
    out.push(v);
  }
  if (!seen.has("spawn")) out.push({ id: "spawn", label: "player start", role: "spawn", position: [0, 0, bounds - 3], rotationY: 0, size: [2, 0.1, 2] });
  if (!seen.has("objective")) out.push({ id: "objective", label: "objective", role: "objective", position: [0, 0, -(bounds - 6)], rotationY: 0, size: [2, 1.1, 2] });
  return out;
}

function applyPreview(level: Level, p: Proposal): Level {
  let volumes = level.volumes.filter((v) => !p.remove?.includes(v.id));
  volumes = volumes.map((v) => {
    const u = p.update?.find((x) => x.id === v.id);
    return u ? { ...v, ...u } : v;
  });
  return { ...level, volumes: [...volumes, ...(p.add ?? [])] };
}

function vec3(x: unknown): [number, number, number] | null {
  if (!Array.isArray(x)) return null;
  const n = x.slice(0, 3).map(Number);
  if (n.length === 2) n.splice(1, 0, 0); // [x, z] -> [x, 0, z]
  return n.length === 3 && n.every(Number.isFinite) ? (n as [number, number, number]) : null;
}

const clampPos = ([x, , z]: [number, number, number], b: number): [number, number, number] => [clamp(r1(x), -b + 0.5, b - 0.5), 0, clamp(r1(z), -b + 0.5, b - 0.5)];
const clampSize = (s: [number, number, number]): [number, number, number] => s.map((n) => clamp(r1(Math.abs(n)), 0.3, 90)) as [number, number, number];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Models answer in degrees (prompts ask for degrees); the level stores radians. */
const deg = (d: number) => (d * Math.PI) / 180;
const pid = (k: string) => `${k}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function uniqueId(base: string, taken: Set<string>): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "box";
  if (!taken.has(slug)) return slug;
  let i = 2;
  while (taken.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

// ---------- usage cap ----------

const hits = new Map<string, number[]>();
let day = new Date().toDateString();
let dayCount = 0;

function rateLimit(ip: string): string | null {
  const today = new Date().toDateString();
  if (today !== day) [day, dayCount] = [today, 0];
  if (++dayCount > MAX_PER_DAY) return "The AI's daily limit for this demo is used up. Try again tomorrow.";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= MAX_PER_IP) return "Too many AI requests. Please wait a few minutes.";
  hits.set(ip, [...recent, now]);
  return null;
}
