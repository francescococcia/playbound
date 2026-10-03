// Share links + local saves. No backend: a shared level lives entirely in the URL hash
// (#l=<deflate+base64url JSON>). Prebaked models are referenced by URL, so a shared dressed
// level shows its models on the public site. The style image (a data URL) is dropped from
// links because it is too big; the style notes travel instead.
import type { Level, Volume } from "./types";

const HASH_KEY = "l";
const SAVES_KEY = "playbound.saves.v1";

/** Fields that define the level; everything transient (status, stage, errors) is dropped. */
function slim(level: Level): Level {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const vec = (v: [number, number, number]) => v.map(r2) as [number, number, number];
  return {
    id: level.id,
    name: level.name,
    bounds: level.bounds,
    styleNotes: level.styleNotes,
    locked: level.locked,
    volumes: level.volumes.map((v): Volume => {
      const keepAsset = v.status === "ready" && v.assetUrl?.startsWith("/assets/");
      return {
        id: v.id,
        label: v.label,
        role: v.role,
        position: vec(v.position),
        rotationY: r2(v.rotationY),
        size: vec(v.size),
        ...(keepAsset && { assetUrl: v.assetUrl, status: "ready" as const, prompt: v.prompt, variant: v.variant }),
      };
    }),
  };
}

// ---------- share links ----------

export async function encodeLevel(level: Level): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(slim(level)));
  const packed = await pipe(bytes, new CompressionStream("deflate-raw"));
  return toBase64Url(packed);
}

export async function decodeLevel(code: string): Promise<Level> {
  const bytes = await pipe(fromBase64Url(code), new DecompressionStream("deflate-raw"));
  const level = JSON.parse(new TextDecoder().decode(bytes)) as Level;
  if (!Array.isArray(level.volumes) || typeof level.bounds !== "number") throw new Error("Not a PLAYBOUND level");
  return { ...level, prove: { status: "idle" } };
}

/** Full link to this level, e.g. https://playbound-eta.vercel.app/#l=... */
export async function shareUrl(level: Level, origin = location.origin + location.pathname): Promise<string> {
  return `${origin}#${HASH_KEY}=${await encodeLevel(level)}`;
}

/** Level from the current page URL (#l=...), or null. Call once on startup. */
export async function levelFromUrl(hash = location.hash): Promise<Level | null> {
  const code = new URLSearchParams(hash.replace(/^#/, "")).get(HASH_KEY);
  if (!code) return null;
  try {
    return await decodeLevel(code);
  } catch {
    return null;
  }
}

// ---------- local saves (this browser only) ----------

export interface SaveEntry {
  id: string;
  name: string;
  savedAt: string;
  volumes: number;
}

interface SaveRecord extends SaveEntry {
  level: Level;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const store = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readSaves(s: Storage | null): SaveRecord[] {
  try {
    return JSON.parse(s?.getItem(SAVES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeSaves(s: Storage | null, saves: SaveRecord[]): boolean {
  try {
    s?.setItem(SAVES_KEY, JSON.stringify(saves));
    return !!s;
  } catch {
    return false;
  }
}

/** Save (or overwrite, by level id). Returns false if the browser blocks storage. */
export function saveLevel(level: Level, s: Storage | null = store()): boolean {
  const rec: SaveRecord = {
    id: level.id,
    name: level.name,
    savedAt: new Date().toISOString(),
    volumes: level.volumes.length,
    level: slim(level),
  };
  return writeSaves(s, [rec, ...readSaves(s).filter((r) => r.id !== level.id)].slice(0, 30));
}

/** Newest first. */
export function listSaves(s: Storage | null = store()): SaveEntry[] {
  return readSaves(s).map(({ level: _l, ...e }) => e);
}

export function loadSave(id: string, s: Storage | null = store()): Level | null {
  const r = readSaves(s).find((x) => x.id === id);
  return r ? { ...r.level, prove: { status: "idle" } } : null;
}

export function deleteSave(id: string, s: Storage | null = store()): void {
  writeSaves(s, readSaves(s).filter((r) => r.id !== id));
}

// ---------- helpers ----------

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): Uint8Array {
  const b = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
