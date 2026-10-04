import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistory } from "./history";
import { usePlaybound } from "./store";

const s = () => usePlaybound.getState();
const h = () => useHistory.getState();
const cart = () => s().level.volumes.find((v) => v.id === "cart")!;

beforeEach(() => {
  vi.useRealTimers();
  s().loadPreset("market-square-fail");
  h().clear();
});

describe("undo / redo", () => {
  it("undoes and redoes an add and a delete", () => {
    const n = s().level.volumes.length;
    const id = s().addVolume("cover", [3, 0, 3]);
    s().removeVolume("hay");
    expect(s().level.volumes).toHaveLength(n);
    h().undo(); // hay back
    expect(s().level.volumes.some((v) => v.id === "hay")).toBe(true);
    h().undo(); // added box gone
    expect(s().level.volumes.some((v) => v.id === id)).toBe(false);
    h().redo();
    expect(s().level.volumes.some((v) => v.id === id)).toBe(true);
  });

  it("a drag (many moves of the same box) is one undo step", () => {
    vi.useFakeTimers();
    const start = cart().position;
    for (let i = 1; i <= 10; i++) {
      s().updateVolume("cart", { position: [start[0] + i * 0.3, 0, start[2]] });
      vi.advanceTimersByTime(30);
    }
    h().undo();
    expect(cart().position).toEqual(start);
  });

  it("accepted AI proposals are undoable; dress progress is not recorded", () => {
    s().addProposal({ id: "p", source: "fix", why: "cart", add: [{ id: "c2", label: "cart", role: "cover", position: [1.6, 0, -2], rotationY: 0, size: [1.2, 1.2, 2.5] }] });
    s().acceptProposal("p");
    const past = h().past.length;
    s().setVolumeAsset("tavern", { status: "generating", stage: "mesh 2/5" });
    expect(h().past.length).toBe(past);
    h().undo();
    expect(s().level.volumes.some((v) => v.id === "c2")).toBe(false);
  });

  it("loading another level starts a fresh history; nothing to undo while locked", () => {
    s().addVolume("prop", [5, 0, 5]);
    s().loadPreset("market-square-pass");
    expect(h().past).toHaveLength(0);
    s().runProve();
    s().lock();
    h().undo();
    expect(s().level.locked).toBe(true);
  });
});
