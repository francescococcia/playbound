// Line of sight from the objective (where defenders stand) to every walkable cell.
// A cell is "seen" if the straight line from the defender's eye to a crouching player's
// head clears every solid box taller than the line at that point. Buildings and landmarks
// hide whole areas; a chest-high cover box hides the cells just behind it.
// Fast path: a height map (tallest solid per cell) + ray marching on the grid.
import { distanceToFootprint, isSolid } from "../geometry.js";
import type { Level } from "../types.js";
import { LOS_STEP_M, TARGET_HEIGHT_M, VIEWER_EYE_M } from "./constants.js";
import type { NavGrid } from "./prove.js";

/** Per cell: 1 = seen from the objective, 0 = hidden, -1 = inside a solid (not walkable). */
export type ExposureGrid = Int8Array;

export function heightMap(level: Level, g: NavGrid): Float32Array {
  const h = new Float32Array(g.cols * g.rows);
  const solids = level.volumes.filter(isSolid);
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const x = -g.bounds + (c + 0.5) * g.cell;
      const z = -g.bounds + (r + 0.5) * g.cell;
      let top = 0;
      for (const v of solids) if (v.size[1] > top && distanceToFootprint(x, z, v) <= 0) top = v.size[1];
      h[r * g.cols + c] = top;
    }
  }
  return h;
}

export function exposureFrom(level: Level, g: NavGrid, viewer: [number, number]): ExposureGrid {
  const heights = heightMap(level, g);
  const out = new Int8Array(g.cols * g.rows);
  const [vx, vz] = viewer;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c;
      if (heights[i] > 0) {
        out[i] = -1;
        continue;
      }
      const tx = -g.bounds + (c + 0.5) * g.cell;
      const tz = -g.bounds + (r + 0.5) * g.cell;
      out[i] = lineClear(heights, g, vx, vz, tx, tz) ? 1 : 0;
    }
  }
  return out;
}

function lineClear(heights: Float32Array, g: NavGrid, x0: number, z0: number, x1: number, z1: number): boolean {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.floor(dist / LOS_STEP_M);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const c = Math.floor((x0 + (x1 - x0) * t + g.bounds) / g.cell);
    const r = Math.floor((z0 + (z1 - z0) * t + g.bounds) / g.cell);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
    const lineH = VIEWER_EYE_M + (TARGET_HEIGHT_M - VIEWER_EYE_M) * t;
    if (heights[r * g.cols + c] > lineH) return false;
  }
  return true;
}
