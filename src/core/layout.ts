// Layout hygiene for boxes the AI proposes (Round 5): every box sits fully inside the map,
// and new solid boxes never overlap existing ones (nudged a little, else left out).
// Shared by the AI server (sketch / map / edit / fix) and the store (map resize).
import { SOLID_ROLES, type Volume } from "./types.js";

/** Map sizes the designer can pick: label → half-extent (`Level.bounds`, metres). */
export const MAP_SIZES = [
  { id: "small", label: "Small · 40 m", bounds: 20 },
  { id: "medium", label: "Medium · 60 m", bounds: 30 },
  { id: "large", label: "Large · 80 m", bounds: 40 },
  { id: "huge", label: "Huge · 120 m", bounds: 60 },
] as const;

/** Smallest map size whose side is at least `metres` (capped at Large). */
export function boundsForWidth(metres: number): number {
  for (const s of MAP_SIZES) if (metres <= s.bounds * 2 + 0.01) return s.bounds;
  return MAP_SIZES[MAP_SIZES.length - 1].bounds;
}

/** Keep this far from the map edge (m). */
const EDGE = 0.5;
/** Minimum gap between solid boxes (m). */
const GAP = 0.2;
/** Furthest we move a box to clear an overlap before leaving it out (m). */
const MAX_NUDGE = 4;

/** Half extents of the box's footprint on the ground (axis-aligned, rotation included). */
export function footprintHalf(v: Pick<Volume, "size" | "rotationY">): [number, number] {
  const c = Math.abs(Math.cos(v.rotationY ?? 0));
  const s = Math.abs(Math.sin(v.rotationY ?? 0));
  const [w, , d] = v.size;
  return [(c * w + s * d) / 2, (s * w + c * d) / 2];
}

/** True when the whole footprint is inside a map of half-extent `bounds`. */
export function isInside(v: Volume, bounds: number): boolean {
  const [hx, hz] = footprintHalf(v);
  return Math.abs(v.position[0]) + hx <= bounds + 1e-6 && Math.abs(v.position[2]) + hz <= bounds + 1e-6;
}

/** Move (and if needed shrink) a box so its whole footprint is inside the map. */
export function keepInside(v: Volume, bounds: number): Volume {
  const lim = bounds - EDGE;
  let size = v.size;
  let [hx, hz] = footprintHalf(v);
  if (hx > lim || hz > lim) {
    const k = Math.min(1, lim / Math.max(hx, 1e-6), lim / Math.max(hz, 1e-6));
    size = [r1(v.size[0] * k), v.size[1], r1(v.size[2] * k)];
    [hx, hz] = footprintHalf({ ...v, size });
  }
  const x = clamp(v.position[0], -lim + hx, lim - hx);
  const z = clamp(v.position[2], -lim + hz, lim - hz);
  return { ...v, size, position: [r1(x), v.position[1], r1(z)] };
}

/** Footprints closer than `gap` (axis-aligned check: safe, slightly strict for rotated boxes). */
export function overlaps(a: Volume, b: Volume, gap = GAP): boolean {
  const [ax, az] = footprintHalf(a);
  const [bx, bz] = footprintHalf(b);
  return Math.abs(a.position[0] - b.position[0]) < ax + bx + gap && Math.abs(a.position[2] - b.position[2]) < az + bz + gap;
}

/** Boxes that block each other: solids, plus spawn/objective, which must not sit inside a solid. */
function blocks(a: Volume, b: Volume): boolean {
  const sa = SOLID_ROLES.includes(a.role);
  const sb = SOLID_ROLES.includes(b.role);
  if (sa && sb) return overlaps(a, b, GAP);
  if (sa || sb) return overlaps(a, b, 0); // a marker inside a solid
  return false; // spawn vs objective: never in the way of each other
}

/**
 * Place `v` next to `others` without overlapping: as is if it fits, else the nearest spot
 * within MAX_NUDGE m (inside the map), else null.
 */
export function placeClear(v: Volume, others: Volume[], bounds: number): Volume | null {
  const start = keepInside(v, bounds);
  const clear = (c: Volume) => isInside(c, bounds) && !others.some((o) => o.id !== c.id && blocks(c, o));
  if (clear(start)) return start;
  const [x0, , z0] = start.position;
  for (let r = 0.5; r <= MAX_NUDGE; r += 0.5) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const c: Volume = { ...start, position: [r1(x0 + Math.cos(a) * r), start.position[1], r1(z0 + Math.sin(a) * r)] };
      if (clear(c)) return c;
    }
  }
  return null;
}

/**
 * Add `incoming` to `existing` one by one (biggest footprint first, so buildings win over
 * crates): each is kept inside the map and nudged clear of what is already there.
 * Spawn and objective are never left out (kept where they are if no spot is found).
 */
export function placeAll(incoming: Volume[], existing: Volume[], bounds: number): { placed: Volume[]; dropped: Volume[] } {
  const area = (v: Volume) => v.size[0] * v.size[2];
  const marker = (v: Volume) => v.role === "spawn" || v.role === "objective";
  const order = [...incoming].sort((a, b) => Number(marker(a)) - Number(marker(b)) || area(b) - area(a));
  const placed: Volume[] = [];
  const dropped: Volume[] = [];
  for (const v of order) {
    const p = placeClear(v, [...existing, ...placed], bounds);
    if (p) placed.push(p);
    else if (marker(v)) placed.push(keepInside(v, bounds));
    else dropped.push(v);
  }
  // Keep the caller's order (ids/labels read naturally in lists).
  placed.sort((a, b) => incoming.findIndex((x) => x.id === a.id) - incoming.findIndex((x) => x.id === b.id));
  return { placed, dropped };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
