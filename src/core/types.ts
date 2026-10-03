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
}

export type ProveReason = "NO_PATH" | "NO_COVER" | null;

export interface ProveResult {
  status: "idle" | "fail" | "pass";
  reason?: ProveReason;
  /** Path from spawn to objective, world coords at y = 0. Empty when NO_PATH. */
  path?: [number, number, number][];
  /** Same length as `path`: true where a cover volume is within COVER_RADIUS_M. */
  covered?: boolean[];
  /** Covered path length / total path length, 0..1. */
  coveredFraction?: number;
  /** Human-readable one-liner for the banner. */
  message?: string;
  checkedAt?: string;
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
  environment?: {
    provider: "hy-world" | "hdri-fallback";
    assetUrl?: string;
  };
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
