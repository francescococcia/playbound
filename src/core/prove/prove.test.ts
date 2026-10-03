import { describe, expect, it } from "vitest";
import { marketSquareFail, marketSquarePass } from "../../presets/marketSquare";
import type { Level } from "../types";
import { prove } from "./prove";

describe("prove on Market Square", () => {
  it("fail preset fails with NO_COVER (the demo's death corridor)", () => {
    const r = prove(marketSquareFail);
    expect(r.status).toBe("fail");
    expect(r.reason).toBe("NO_COVER");
    expect(r.path!.length).toBeGreaterThan(10);
    expect(r.covered).toHaveLength(r.path!.length);
  });

  it("pass preset passes after the cart is moved next to the route", () => {
    const r = prove(marketSquarePass);
    expect(r.status).toBe("pass");
    expect(r.coveredFraction!).toBeGreaterThanOrEqual(0.25);
  });

  it("blocking the corridor gives NO_PATH", () => {
    const blocked: Level = {
      ...marketSquareFail,
      volumes: [
        ...marketSquareFail.volumes,
        { id: "rubble", label: "rubble", role: "block", position: [0, 0, 8], rotationY: 0, size: [4, 2, 2] },
      ],
    };
    const r = prove(blocked);
    expect(r.status).toBe("fail");
    expect(r.reason).toBe("NO_PATH");
  });

  it("path starts at spawn and ends at the objective", () => {
    const r = prove(marketSquarePass);
    const first = r.path![0];
    const last = r.path![r.path!.length - 1];
    expect(Math.hypot(first[0] - 0, first[2] - 17)).toBeLessThan(0.5);
    expect(Math.hypot(last[0] - 0, last[2] + 6)).toBeLessThan(0.5);
  });
});
