// Prove: can a player get from spawn to objective, and is the approach covered?
// 1. Rasterise the level into a GRID_CELL_M grid; a cell is blocked if a solid volume's
//    footprint is closer than AGENT_RADIUS_M (so the bot has a body, like the player).
// 2. A* (8-connected, no corner cutting) from spawn to objective -> NO_PATH if none.
// 3. Mark each path point "covered" if any `cover` volume is within COVER_RADIUS_M.
//    Covered length / total length < MIN_COVERED_PATH_FRACTION -> NO_COVER.
import { distanceToFootprint, isSolid } from "../geometry";
import type { Level, ProveResult, Volume } from "../types";
import {
  AGENT_RADIUS_M,
  COVER_RADIUS_M,
  GRID_CELL_M,
  MIN_COVERED_PATH_FRACTION,
  SNAP_RADIUS_M,
} from "./constants";

export interface NavGrid {
  cols: number;
  rows: number;
  cell: number;
  bounds: number;
  blocked: Uint8Array; // 1 = blocked, index = row * cols + col
}

export function buildNavGrid(level: Level): NavGrid {
  const cell = GRID_CELL_M;
  const n = Math.round((level.bounds * 2) / cell);
  const blocked = new Uint8Array(n * n);
  const solids = level.volumes.filter(isSolid);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const [x, z] = cellCenter(c, r, cell, level.bounds);
      const nearEdge = level.bounds - Math.max(Math.abs(x), Math.abs(z)) < AGENT_RADIUS_M;
      if (nearEdge || solids.some((v) => distanceToFootprint(x, z, v) < AGENT_RADIUS_M)) {
        blocked[r * n + c] = 1;
      }
    }
  }
  return { cols: n, rows: n, cell, bounds: level.bounds, blocked };
}

export function prove(level: Level): ProveResult {
  const checkedAt = new Date().toISOString();
  const spawn = level.volumes.find((v) => v.role === "spawn");
  const goal = level.volumes.find((v) => v.role === "objective");
  if (!spawn || !goal) {
    return { status: "fail", reason: "NO_PATH", path: [], message: "Level needs one spawn and one objective.", checkedAt };
  }

  const grid = buildNavGrid(level);
  // Markers drawn on a wall or touching a box (common in sketch imports) start from the
  // nearest walkable cell within SNAP_RADIUS_M instead of failing outright.
  const start = nearestWalkable(grid, toCell(spawn, grid));
  const end = nearestWalkable(grid, toCell(goal, grid));
  const cells = start && end ? astar(grid, start, end) : null;
  if (!cells) {
    return { status: "fail", reason: "NO_PATH", path: [], message: "No walkable route from spawn to objective.", checkedAt };
  }

  const path = cells.map(([c, r]) => {
    const [x, z] = cellCenter(c, r, grid.cell, grid.bounds);
    return [x, 0, z] as [number, number, number];
  });
  const covers = level.volumes.filter((v) => v.role === "cover");
  const covered = path.map(([x, , z]) => covers.some((v) => distanceToFootprint(x, z, v) <= COVER_RADIUS_M));

  // Length-weighted: a segment counts as covered when both its ends are.
  let total = 0;
  let cov = 0;
  for (let i = 1; i < path.length; i++) {
    const len = Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
    total += len;
    if (covered[i] && covered[i - 1]) cov += len;
  }
  const coveredFraction = total > 0 ? cov / total : 0;
  const pct = Math.round(coveredFraction * 100);
  const need = Math.round(MIN_COVERED_PATH_FRACTION * 100);

  if (coveredFraction < MIN_COVERED_PATH_FRACTION) {
    return {
      status: "fail",
      reason: "NO_COVER",
      path,
      covered,
      coveredFraction,
      message: `Death corridor: only ${pct}% of the ${Math.round(total)} m route has cover (need ${need}%).`,
      checkedAt,
    };
  }
  return {
    status: "pass",
    reason: null,
    path,
    covered,
    coveredFraction,
    message: `Playable: ${Math.round(total)} m route, ${pct}% covered.`,
    checkedAt,
  };
}

// ---------- internals ----------

function cellCenter(c: number, r: number, cell: number, bounds: number): [number, number] {
  return [-bounds + (c + 0.5) * cell, -bounds + (r + 0.5) * cell];
}

function toCell(v: Volume, g: NavGrid): [number, number] {
  const c = Math.floor((v.position[0] + g.bounds) / g.cell);
  const r = Math.floor((v.position[2] + g.bounds) / g.cell);
  return [clampI(c, g.cols), clampI(r, g.rows)];
}

/** Breadth-first search for the closest unblocked cell, up to SNAP_RADIUS_M away. */
function nearestWalkable(g: NavGrid, [c0, r0]: [number, number]): [number, number] | null {
  const maxRing = Math.ceil(SNAP_RADIUS_M / g.cell);
  for (let ring = 0; ring <= maxRing; ring++) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || g.blocked[r * g.cols + c]) continue;
        const d = dc * dc + dr * dr;
        if (d < bestD) {
          bestD = d;
          best = [c, r];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function clampI(n: number, max: number): number {
  return Math.min(max - 1, Math.max(0, n));
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

function astar(g: NavGrid, start: [number, number], goal: [number, number]): [number, number][] | null {
  const { cols, rows, blocked } = g;
  const idx = (c: number, r: number) => r * cols + c;
  const s = idx(...start);
  const t = idx(...goal);
  // Spawn/objective markers are never obstacles, but a solid box could be placed on them.
  if (blocked[s] || blocked[t]) return null;

  const gScore = new Float64Array(cols * rows).fill(Infinity);
  const came = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const h = (i: number) => {
    const dx = Math.abs((i % cols) - goal[0]);
    const dz = Math.abs(Math.floor(i / cols) - goal[1]);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); // octile
  };
  const open = new MinHeap();
  gScore[s] = 0;
  open.push(s, h(s));

  while (open.size) {
    const cur = open.pop();
    if (cur === t) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cc = cur % cols;
    const cr = Math.floor(cur / cols);
    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (blocked[ni] || closed[ni]) continue;
      // No corner cutting on diagonals.
      if (dc && dr && (blocked[idx(cc + dc, cr)] || blocked[idx(cc, cr + dr)])) continue;
      const ng = gScore[cur] + cost;
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        came[ni] = cur;
        open.push(ni, ng + h(ni));
      }
    }
  }
  if (gScore[t] === Infinity) return null;
  const out: [number, number][] = [];
  for (let i = t; i !== -1; i = came[i]) out.push([i % cols, Math.floor(i / cols)]);
  return out.reverse();
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.keys.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}
