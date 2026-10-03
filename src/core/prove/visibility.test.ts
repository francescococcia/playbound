import { describe, expect, it } from "vitest";
import { marketSquareFail } from "../../presets/marketSquare";
import type { Level, Volume } from "../types";
import { buildNavGrid, prove } from "./prove";
import { exposureFrom } from "./visibility";

const box = (id: string, role: Volume["role"], x: number, z: number, size: [number, number, number]): Volume => ({
  id, label: id, role, position: [x, 0, z], rotationY: 0, size,
});

const at = (level: Level, x: number, z: number) => {
  const g = buildNavGrid(level);
  const e = exposureFrom(level, g, [0, 0]);
  const c = Math.floor((x + g.bounds) / g.cell);
  const r = Math.floor((z + g.bounds) / g.cell);
  return e[r * g.cols + c];
};

describe("line of sight from the objective", () => {
  const level = (extra: Volume[]): Level => ({ id: "t", name: "t", bounds: 20, locked: false, volumes: extra });

  it("open ground is seen; a tall wall hides what is behind it; solids are -1", () => {
    const l = level([box("wall", "block", 5, 0, [1, 4, 8])]);
    expect(at(l, -10, 0)).toBe(1); // open side
    expect(at(l, 10, 0)).toBe(0); // behind the wall
    expect(at(l, 5, 0)).toBe(-1); // inside the wall
  });

  it("chest-high cover hides a crouching player right behind it, not one far away", () => {
    const l = level([box("cart", "cover", 8, 0, [1.2, 1.2, 2.5])]);
    expect(at(l, 9.5, 0)).toBe(0); // tucked behind the cart
    expect(at(l, 8, 6)).toBe(1); // off to the side: in the open
  });

  it("a building that blocks the view of the corridor raises the protected share", () => {
    const base = prove(marketSquareFail).coveredFraction!;
    const tent: Level = { ...marketSquareFail, volumes: [...marketSquareFail.volumes, box("tent", "block", 0, -2.5, [3, 4, 1])] };
    const r = prove(tent);
    expect(r.coveredFraction!).toBeGreaterThan(base);
    expect(r.exposure).toHaveLength(r.exposureCols! * r.exposureCols!);
  });
});
