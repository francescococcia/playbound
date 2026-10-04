// The Co-designer agent: one conversational entry point over all the AI skills.
//   1. Ground the model in FACTS computed by our code (Prove result, exposed stretch, what the
//      objective sees, the boxes), never letting it guess the state of the level.
//   2. The model picks an intent and drafts an answer (+ up to 3 edit proposals).
//   3. Our code does the real work per intent: the verified fix loop, sketch/style readers,
//      or validation + Prove preview of every edit. Claims are checked, not trusted.
import { prove } from "../../src/core/prove/prove.js";
import type { AgentRequest, AgentResponse } from "../../src/core/ai/types.js";
import type { Level, Proposal, ProveResult } from "../../src/core/types.js";
import { geminiJson } from "./gemini.js";
import { MAP_SIZES } from "../../src/core/layout.js";
import { buildEditProposal, fix, longestExposedStretch, sketch, style, volumeRules } from "./handler.js";

type Intent = AgentResponse["intent"];
const INTENTS: Intent[] = ["fix", "explain", "edit", "sketch", "build", "style", "chat"];

export async function agent(key: string, req: AgentRequest): Promise<AgentResponse> {
  const level = req?.level;
  const message = (req?.message ?? "").trim().slice(0, 800);
  if (!level) throw new Error("Need a level");
  if (!message && !req.image) throw new Error("Ask something or drop an image");
  const now = prove(level);
  const facts = levelFacts(level, now);
  const history = (req.history ?? []).slice(-6).map((t) => `${t.role === "user" ? "Designer" : "You"}: ${t.text.slice(0, 300)}`).join("\n");

  const prompt = `You are the Co-designer inside PLAYBOUND, a level-design tool. The designer owns the layout; you only PROPOSE changes they accept or reject.
How Prove works: a bot walks from spawn to objective; a route point is "protected" if it is out of the objective's line of sight (defenders stand at the objective) or within 2.5 m of chest-high cover. The level passes when >= 25% of the route is protected. Only a passing level can be locked; a locked level's boxes cannot change (only looks/style).
${volumeRules(level.bounds * 2)}

FACTS about the current level (computed, trust these):
${facts}
${history ? `\nConversation so far (it may mention boxes that no longer exist: only FACTS describe the level now):\n${history}\n` : ""}
Designer: "${message || "(sent an image)"}"${req.image ? "\nAn image is attached." : ""}

Choose ONE intent:
- "fix": make a failing level pass (our verified fixer will place cover; you just explain)
- "explain": answer a question about the level, Prove, sightlines, why it fails, etc. (no edits)
- "edit": change the layout as asked (add/move/remove boxes). Give 1-3 ALTERNATIVE proposals, each a complete small change.
  To change the MAP SIZE (the designer asks for a bigger/smaller map, or 40/60/80 m), set "mapSize" to 40, 60 or 80 and give no edits.
  STRICT: every object your "why" mentions adding (cart, wall, crates...) MUST be a full entry in that proposal's "add" (label, role, position [x,0,z], size [w,h,d]). Every box you move/resize MUST be in "update" with its id. Don't describe changes you didn't include.
- "sketch": the attached image is a layout drawing/map to turn into a greybox
- "build": no image, the designer describes a WHOLE NEW level in words ("build me a smugglers' harbour"); our level builder drafts it, you just introduce it
- "style": the attached image is a look/mood reference for the 3D art, OR (no image) the designer asks for a look/style/art direction in words
- "chat": anything else
Rules: reply in 1-3 short sentences, plain words, refer to boxes by their labels, use numbers from FACTS. Nothing is applied until the designer clicks Accept: say "I propose" / "here are options", never "I've added / locked in / applied". Never claim a change passes unless it is a "fix". If the level is locked, don't propose layout edits; explain it must be unlocked.
Also give 2-3 short follow-up suggestions the designer could click next (max 6 words each).
Return JSON: {"intent", "reply", "edits": [{"why", "add": [...], "update": [{"id","position"?,"size"?,"rotationY"?}], "remove": [ids]}], "mapSize"?: 40|60|80, "chips": [..]}`;

  const { data, model } = await geminiJson<{ intent?: string; reply?: string; edits?: unknown[]; mapSize?: number; chips?: unknown[] }>(key, prompt, {
    // No responseSchema here on purpose: with the deeply nested schema Gemini drops the
    // "add" arrays. Free JSON is complete, and every edit is validated server-side anyway.
    image: req.image,
  });

  let intent: Intent = INTENTS.includes(data.intent as Intent) ? (data.intent as Intent) : "chat";
  if (req.intent && INTENTS.includes(req.intent)) intent = req.intent;
  else if (req.image && intent !== "style") intent = intent === "sketch" ? "sketch" : looksLikeStyle(message) ? "style" : "sketch";
  let reply = (data.reply ?? "").trim() || "Done.";
  const chips = (data.chips ?? []).filter((c): c is string => typeof c === "string" && !!c.trim()).map((c) => c.trim().slice(0, 48)).slice(0, 3);
  const proposals: Proposal[] = [];

  if (intent === "fix") {
    const r = await fix(key, { level });
    if (r.proposal) {
      proposals.push(r.proposal);
      // Say what the VERIFIED fix does (the draft reply may describe something else).
      reply = r.proposal.why; // already ends with the Prove result
    } else if (r.note) reply = r.note;
  } else if (intent === "sketch" && req.image) {
    const r = await sketch(key, { image: req.image });
    if (r.proposal) proposals.push(r.proposal);
  } else if (intent === "build" && !req.image) {
    if (level.locked) {
      reply = "The layout is locked, so I can't replace it. Unlock it in the Lock step, then ask again.";
    } else {
      const r = await sketch(key, { text: message });
      if (r.proposal) proposals.push(r.proposal);
    }
  } else if (intent === "style") {
    const r = await style(key, req.image ? { image: req.image } : { text: `${message}${level.styleNotes ? "" : ` (level: ${levelSummary(level)})`}` });
    if (r.proposal) proposals.push(r.proposal);
  } else if (intent === "edit") {
    const size = MAP_SIZES.find((m) => m.bounds * 2 === Number(data.mapSize));
    if (level.locked) {
      reply = "The layout is locked, so boxes can't change. Unlock it in the Lock step, then ask again.";
    } else if (size && size.bounds === level.bounds) {
      reply = `The map is already ${size.bounds * 2} m × ${size.bounds * 2} m. Sizes: 40, 60 or 80 m.`;
    } else if (size) {
      const bigger = size.bounds > level.bounds;
      proposals.push({
        id: `map-${Date.now().toString(36)}`,
        source: "text",
        why: `Map ${level.bounds * 2} m → ${size.bounds * 2} m.${bigger ? " Your boxes stay where they are; there's more room around them." : " Boxes near the edge move inward."}`,
        bounds: size.bounds,
      });
      reply = `I propose ${bigger ? "growing" : "shrinking"} the map to ${size.bounds * 2} m × ${size.bounds * 2} m. Accept to apply it, then run Prove again.`;
    } else {
      for (const e of (data.edits ?? []).slice(0, 3)) {
        const p = buildEditProposal(level, e as Record<string, unknown>, "text");
        if (p) proposals.push(p);
      }
      if (!proposals.length) reply = `${reply} (I couldn't turn that into a valid change. Try naming a box or a place, e.g. "near the well".)`;
    }
  }

  return { intent, reply, proposals, chips: chips.length ? chips : defaultChips(level, now), model };
}

/** Plain-text facts the model must ground its answer in. */
function levelFacts(level: Level, r: ProveResult): string {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const counts = new Map<string, number>();
  for (const v of level.volumes) counts.set(v.role, (counts.get(v.role) ?? 0) + 1);
  const seen = r.exposure?.filter((x) => x === 1).length ?? 0;
  const open = r.exposure?.filter((x) => x >= 0).length ?? 1;
  const exposed = longestExposedStretch(r);
  const lines = [
    `Locked: ${level.locked ? "yes" : "no"}. Style notes: "${level.styleNotes ?? "none"}".`,
    `Boxes: ${[...counts].map(([k, n]) => `${n} ${k}`).join(", ") || "none"}.`,
    `Prove: ${r.status}${r.reason ? ` (${r.reason})` : ""}. ${r.message ?? ""}`,
    r.path?.length ? `Route length ${Math.round(r.path.length * 0.5)} m approx; ${r.exposedMeters ?? "?"} m of it in the open.` : "No route.",
    exposed.length ? `Longest exposed stretch (x,z): from ${JSON.stringify(exposed[0])} to ${JSON.stringify(exposed[exposed.length - 1])}.` : "",
    `The objective can see ${Math.round((seen / Math.max(open, 1)) * 100)}% of the open ground.`,
    `All boxes: ${JSON.stringify(level.volumes.map((v) => ({ id: v.id, label: v.label, role: v.role, at: [r1(v.position[0]), r1(v.position[2])], size: v.size })))}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Short description of the boxes, so a style written from words fits the level. */
function levelSummary(level: Level): string {
  return level.volumes.filter((v) => v.role !== "spawn" && v.role !== "objective").map((v) => v.label).slice(0, 12).join(", ");
}

function defaultChips(level: Level, r: ProveResult): string[] {
  if (level.volumes.length < 3) return ["Build from my sketch", "Start a market square", "Add a spawn and goal"];
  if (r.status === "fail") return ["Fix the death corridor", "Why does it fail?", "Add a flanking route"];
  if (!level.locked) return ["Make it more challenging", "Check sightlines from the goal", "Add landmarks"];
  return ["Suggest a style", "Explain this level", "What should I dress first?"];
}

function looksLikeStyle(msg: string): boolean {
  return /style|look|mood|colou?r|art|vibe|aesthetic|like this/i.test(msg);
}
