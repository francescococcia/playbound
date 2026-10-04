// SHARED CONTRACT between Claude Code (src/core, api) and Cursor (src/ui).
// Do not change without a note in HANDOFF.md. Additive optional fields only.
//
// Coordinate system (three.js default):
//   +X = east, +Y = up, +Z = south. 1 unit = 1 meter.
//   `position` is the CENTER OF THE BOTTOM FACE of the box (it sits on the ground at y = 0).
//   So the box spans y from position[1] to position[1] + size[1].
//   `rotationY` is radians around +Y. `size` is [width (X), height (Y), depth (Z)] before rotation.

export type Role = "spawn" | "objective" | "cover" | "block" | "landmark" | "prop";

export type VolumeStatus = "empty" | "queued" | "generating" | "ready" | "error";

export interface Volume {
  id: string;
  label: string;
  role: Role;
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
  locked?: boolean;
  assetUrl?: string; // generated GLB (visual only, never collision)
  prompt?: string;
  status?: VolumeStatus;
  error?: string;
  /** Dress progress detail for the UI, e.g. "texture 3/5" or "optimizing". */
  stage?: string;
  /** Regenerate counter: 0 = first generation, +1 per Regenerate (part of the cache key). */
  variant?: number;
  /** Look-only request for this box ("glassier facade"), added to its Rodin prompt. */
  lookNote?: string;
}

export type ProveReason = "NO_PATH" | "NO_COVER" | null;

export interface ProveResult {
  status: "idle" | "fail" | "pass";
  reason?: ProveReason;
  /** Path from spawn to objective, world coords at y = 0. Empty when NO_PATH. */
  path?: [number, number, number][];
  /** Same length as `path`: true where the point is protected (hidden from the objective OR cover within COVER_RADIUS_M). */
  covered?: boolean[];
  /** Protected path length / total path length, 0..1 (protected = out of sight OR near cover). */
  coveredFraction?: number;
  /**
   * Heatmap: line of sight from the objective, one value per grid cell, row-major
   * (index = row * exposureCols + col). 1 = seen, 0 = hidden, -1 = inside a solid.
   * Cell (col,row) centre in world = (-bounds + (col + 0.5) * exposureCell, -bounds + (row + 0.5) * exposureCell).
   */
  exposure?: number[];
  exposureCols?: number;
  exposureCell?: number;
  /** Path length (m) seen from the objective with no cover nearby. */
  exposedMeters?: number;
  /** Human-readable one-liner for the banner. */
  message?: string;
  checkedAt?: string;
}

/** The map / sketch the layout was read from, laid on the floor (centred at 0,0, north = -Z). */
export interface GroundImage {
  /** Image URL (a data URL for an upload, or a hosted /path). Empty until the client attaches it. */
  imageUrl: string;
  /** Real-world metres the image covers along X (width) and Z (depth). */
  width: number;
  depth: number;
  /** Credit line to show with the image (e.g. "© OpenStreetMap contributors"). */
  credit?: string;
}

export interface Level {
  id: string;
  name: string;
  /** Square play area: x and z both in [-bounds, +bounds]. The edge acts as the town wall. */
  bounds: number;
  styleRefUrl?: string;
  styleNotes?: string;
  prove?: ProveResult;
  locked: boolean;
  volumes: Volume[];
  /** Map / sketch image under the level (Round 5). */
  ground?: GroundImage;
  environment?: {
    provider: "hy-world" | "hdri-fallback";
    assetUrl?: string;
  };
}

/**
 * An AI suggestion the designer must Accept or Reject. Never applied automatically.
 * UI: draw `add` volumes as ghost boxes, `move` targets as ghosts with an arrow,
 * and show `why` next to Accept / Reject.
 */
export interface Proposal {
  id: string;
  source: "sketch" | "text" | "fix" | "style";
  why: string;
  /** New volumes to add (ids are unique; accepted as-is). */
  add?: Volume[];
  /** Existing volumes to change (by id). */
  update?: { id: string; position?: [number, number, number]; rotationY?: number; size?: [number, number, number] }[];
  /** Existing volume ids to remove. */
  remove?: string[];
  /** Replace the whole layout (sketch import). */
  replaceAll?: boolean;
  /** Style suggestion (from a style image). */
  styleNotes?: string;
  /** Name for the level (sketch / map / description), applied with replaceAll. */
  levelName?: string;
  /** Look change after (or before) Dress: these boxes get a new model; gameplay boxes don't move. */
  redress?: { ids: string[]; note?: string };
  /** Unlock the layout (the designer asked for a layout change on a locked level). */
  unlock?: boolean;
  /** Floor image for a replaceAll layout read from an image (the client fills imageUrl). */
  ground?: GroundImage;
  /** New map half-extent in metres (20 = 40 m square, 30 = 60 m, 40 = 80 m). */
  bounds?: number;
  /** Prove result if this proposal were accepted (filled by the fix agent). */
  previewProve?: ProveResult;
}

/** Roles that are solid for movement (FPS collision + Prove pathfinding). */
export const SOLID_ROLES: Role[] = ["cover", "block", "landmark", "prop"];

/** Roles that get a Rodin-generated mesh during Dress. */
export const DRESS_ROLES: Role[] = ["cover", "block", "landmark", "prop"];

/** Suggested greybox colours per role (UI may use these). */
export const ROLE_COLORS: Record<Role, string> = {
  spawn: "#3fb950",
  objective: "#f2cc60",
  cover: "#58a6ff",
  block: "#8b949e",
  landmark: "#d2a8ff",
  prop: "#c9d1d9",
};
