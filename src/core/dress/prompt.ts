// Deterministic Rodin prompt + cache key for a contract volume.
// Same volume + same style => same prompt => same key => cached GLB, no credits spent twice.
import type { Role, Volume } from "../types";

export const ROLE_HINTS: Record<Role, string> = {
  spawn: "player start marker",
  objective: "the objective players must reach",
  cover: "provides chest-high cover for a standing human",
  block: "solid obstacle that blocks movement and sight",
  landmark: "readable landmark visible from across a courtyard",
  prop: "set dressing prop that fits the space",
};

const m = (n: number) => `${Math.round(n * 10) / 10}m`;

export function buildPrompt(v: Volume, styleNotes?: string): string {
  const styleBlock = styleNotes?.trim() ? `Style: ${styleNotes.trim()}.` : "Style: clean, readable stylised game art.";
  return [
    styleBlock,
    "Game-ready prop for a first-person level.",
    `Object: ${v.label}.`,
    ...(v.lookNote?.trim() ? [`Details: ${v.lookNote.trim()}.`] : []),
    `Gameplay role: ${v.role} (${ROLE_HINTS[v.role]}).`,
    `Exact real-world size: ${m(v.size[0])} wide x ${m(v.size[1])} tall x ${m(v.size[2])} deep.`,
    "Centered, grounded, no floating parts, clean silhouette readable at gameplay distance.",
    "Single object, no scene, no characters, no base platform.",
  ].join("\n");
}

/** Short stable hash (FNV-1a, 32-bit, hex). Works in browser and Node. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Cache key for a generated asset. `seed` lets Regenerate ask for a new variant. */
/** Bump when the generation pipeline changes so old models aren't reused (bbox = API + bbox_condition). */
export const PIPELINE_VERSION = "bbox1";

export function assetKey(prompt: string, size: [number, number, number], seed = 0): string {
  return hash(`${prompt}|${size.join("x")}|${seed}|${PIPELINE_VERSION}`);
}
