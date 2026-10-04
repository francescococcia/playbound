import { describe, expect, it } from "vitest";
import { boundsForWidth, isInside, keepInside, overlaps, placeAll, placeClear } from "./layout";
import type { Volume } from "./types";

const box = (id: string, x: number, z: number, w = 2, d = 2, role: Volume["role"] = "block", rotationY = 0): Volume => ({
  id,
  label: id,
  role,
  position: [x, 0, z],
  rotationY,
  size: [w, 3, d],
});

describe("layout hygiene", () => {
  it("keeps the whole footprint inside the map (not just the centre)", () => {
    const v = keepInside(box("hall", 16, 0, 14, 4), 20);
    expect(isInside(v, 20)).toBe(true);
    expect(v.position[0]).toBeLessThanOrEqual(12.5);
  });

  it("shrinks a box bigger than the map", () => {
    const v = keepInside(box("wall", 0, 0, 60, 2), 20);
    expect(v.size[0]).toBeLessThanOrEqual(39);
    expect(isInside(v, 20)).toBe(true);
  });

  it("uses the rotated footprint", () => {
    expect(isInside(box("r", 18, 0, 1, 6, "block", Math.PI / 2), 20)).toBe(false);
  });

  it("nudges a new box off an existing one, or leaves it out when boxed in", () => {
    const tavern = box("tavern", 0, 0, 8, 8);
    const crate = placeClear(box("crate", 1, 1, 1, 1, "cover"), [tavern], 20)!;
    expect(overlaps(crate, tavern)).toBe(false);
    const walls = [box("n", 0, -3, 7, 1), box("s", 0, 3, 7, 1), box("w", -3, 0, 1, 7), box("e", 3, 0, 1, 7), box("mid", 0, 0, 30, 30)];
    expect(placeClear(box("trapped", 0, 0, 1, 1, "cover"), walls, 20)).toBeNull();
  });

  it("places buildings before small props and never drops spawn/objective", () => {
    const { placed, dropped } = placeAll(
      [box("stall", 0, 0, 2, 2, "cover"), box("guildhall", 0, 0, 10, 10), box("spawn", 0, 0, 2, 2, "spawn")],
      [],
      20,
    );
    const hall = placed.find((v) => v.id === "guildhall")!;
    expect(hall.position).toEqual([0, 0, 0]); // the big one stays put
    expect(placed.some((v) => v.id === "spawn")).toBe(true);
    for (const v of placed) if (v.id !== "guildhall" && v.role !== "spawn") expect(overlaps(v, hall)).toBe(false);
    expect(dropped.length + placed.length).toBe(3);
  });

  it("picks a map size from the real width", () => {
    expect(boundsForWidth(35)).toBe(20);
    expect(boundsForWidth(55)).toBe(30);
    expect(boundsForWidth(120)).toBe(40);
  });
});
