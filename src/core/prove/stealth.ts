// Live stealth state for Walk / Play (Round 5): the same rule Prove uses for the route,
// applied to wherever the player stands. "hidden" = out of the objective's line of sight,
// "cover" = in sight but within COVER_RADIUS_M of a cover box, "seen" = exposed.
import { create } from "zustand";
import { distanceToFootprint } from "../geometry";
import type { Level, ProveResult } from "../types";
import { COVER_RADIUS_M } from "./constants";

export type Stealth = "hidden" | "cover" | "seen";

export function stealthAt(level: Level, r: ProveResult | undefined, x: number, z: number): Stealth | null {
  if (!r?.exposure || !r.exposureCols || !r.exposureCell) return null;
  const col = Math.floor((x + level.bounds) / r.exposureCell);
  const row = Math.floor((z + level.bounds) / r.exposureCell);
  if (col < 0 || row < 0 || col >= r.exposureCols || row >= r.exposureCols) return null;
  if (r.exposure[row * r.exposureCols + col] !== 1) return "hidden";
  const nearCover = level.volumes.some((v) => v.role === "cover" && distanceToFootprint(x, z, v) <= COVER_RADIUS_M);
  return nearCover ? "cover" : "seen";
}

/** Shared between the 3D probe (inside the canvas) and the HUD (DOM). */
export const useStealth = create<{
  state: Stealth | null;
  /** Seconds spent "seen" since the last reset (Play mode shows it on the win card). */
  seenSeconds: number;
  reset: () => void;
}>((set) => ({
  state: null,
  seenSeconds: 0,
  reset: () => set({ state: null, seenSeconds: 0 }),
}));
