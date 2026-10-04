import { describe, expect, it } from "vitest";
import type { Level, Volume } from "../types";
import { prove } from "./prove";
import { stealthAt } from "./stealth";

const box = (id: string, role: Volume["role"], x: number, z: number, w: number, h: number, d: number): Volume => ({
  id,
  label: id,
  role,
  position: [x, 0, z],
  rotationY: 0,
  size: [w, h, d],
});

// Objective at the north; a tall wall hides the south-west corner; a cart sits in the open east.
const level: Level = {
  id: "t",
  name: "t",
  bounds: 20,
  locked: false,
  volumes: [
    box("spawn", "spawn", 0, 17, 2, 0.1, 2),
    box("goal", "objective", 0, -15, 2, 1.1, 2),
    box("wall", "block", -10, 0, 12, 8, 2),
    box("cart", "cover", 10, 5, 1.2, 1.2, 2.5),
  ],
};
const r = prove(level);

describe("stealthAt", () => {
  it("is seen in the open, hidden behind a wall, in cover next to a cover box", () => {
    expect(stealthAt(level, r, 0, 10)).toBe("seen");
    expect(stealthAt(level, r, -10, 6)).toBe("hidden");
    expect(stealthAt(level, r, 11.5, 5)).toBe("cover");
  });

  it("returns null without a Prove result or outside the map", () => {
    expect(stealthAt(level, undefined, 0, 0)).toBeNull();
    expect(stealthAt(level, r, 50, 0)).toBeNull();
  });
});
