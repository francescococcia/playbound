import { Box3, BoxGeometry, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitToVolume, MAX_STRETCH } from "./fit";

const worldBox = (m: Mesh) => {
  m.updateMatrixWorld(true);
  return new Box3().setFromObject(m);
};

describe("fitToVolume", () => {
  it("scales uniformly to stay inside the box, grounded and centred", () => {
    // Like the Rodin cart: ~1.6 x 1.9 x 1.85, centred on its middle.
    const m = new Mesh(new BoxGeometry(1.64, 1.9, 1.85));
    const r = fitToVolume(m, [1.2, 1.2, 2.5]);
    const b = worldBox(m);
    const s = b.getSize(new Vector3());
    expect(s.x).toBeLessThanOrEqual(1.2 + 1e-6);
    expect(s.y).toBeLessThanOrEqual(1.2 + 1e-6);
    expect(s.z).toBeLessThanOrEqual(2.5 + 1e-6);
    expect(b.min.y).toBeCloseTo(0, 6);
    expect(b.getCenter(new Vector3()).x).toBeCloseTo(0, 6);
    expect(b.getCenter(new Vector3()).z).toBeCloseTo(0, 6);
    expect(r.fill).toBeGreaterThan(0);
    expect(r.fill).toBeLessThanOrEqual(1);
  });

  it("stretches sideways at most MAX_STRETCH, never taller, never outside", () => {
    const m = new Mesh(new BoxGeometry(1, 1, 1)); // cube into a wide, flat box
    const r = fitToVolume(m, [3, 1, 1.1]);
    const s = worldBox(m).getSize(new Vector3());
    expect(r.stretch[0]).toBeCloseTo(MAX_STRETCH, 6); // capped: box would allow 3x
    expect(r.stretch[1]).toBeCloseTo(1.1, 6); // box allows 1.1x
    expect(s.x).toBeCloseTo(MAX_STRETCH, 5);
    expect(s.y).toBeCloseTo(1, 5);
    expect(s.z).toBeLessThanOrEqual(1.1 + 1e-6);
  });

  it("turns a long model 90° when the box's long side is the other axis", () => {
    const m = new Mesh(new BoxGeometry(4, 1, 1)); // long in X
    const r = fitToVolume(m, [1, 1, 4]); // box long in Z
    expect(r.rotated).toBe(true);
    expect(r.scale).toBeCloseTo(1, 6);
    const s = worldBox(m).getSize(new Vector3());
    expect(s.z).toBeCloseTo(4, 5);
  });
});
