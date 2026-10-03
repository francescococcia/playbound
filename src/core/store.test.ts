import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybound } from "./store";
import type { Proposal } from "./types";

const s = () => usePlaybound.getState();
const vol = (id: string) => s().level.volumes.find((v) => v.id === id);

beforeEach(() => s().loadPreset("market-square-fail"));

describe("editing", () => {
  it("adds, duplicates and removes boxes; resets Prove; unique ids", () => {
    s().runProve();
    const id = s().addVolume("cover", [2, 0, 0]);
    expect(id).toBe("low-wall");
    expect(s().level.prove?.status).toBe("idle");
    expect(s().selectedId).toBe(id);
    const dup = s().duplicateVolume(id);
    expect(dup).toBe("low-wall-2");
    expect(vol(dup)!.position).toEqual([3.5, 0, 1.5]);
    s().removeVolume(id);
    expect(vol(id)).toBeUndefined();
  });

  it("keeps a single spawn / objective", () => {
    s().addVolume("spawn", [5, 0, 15]);
    expect(s().level.volumes.filter((v) => v.role === "spawn")).toHaveLength(1);
    expect(s().level.volumes.find((v) => v.role === "spawn")!.position).toEqual([5, 0, 15]);
  });

  it("ignores edits while locked", () => {
    s().loadPreset("market-square-pass");
    s().runProve();
    s().lock();
    const n = s().level.volumes.length;
    expect(s().addVolume("prop")).toBe("");
    s().removeVolume("cart");
    expect(s().level.volumes).toHaveLength(n);
  });

  it("newLevel starts with just spawn + objective", () => {
    s().newLevel("Test");
    expect(s().level.volumes.map((v) => v.role).sort()).toEqual(["objective", "spawn"]);
    expect(s().level.name).toBe("Test");
  });
});

describe("proposals", () => {
  const fix: Proposal = {
    id: "p1",
    source: "fix",
    why: "Cart next to the exposed stretch",
    add: [{ id: "cart", label: "market cart", role: "cover", position: [1.6, 0, -2], rotationY: 0, size: [1.2, 1.2, 2.5] }],
  };

  it("are not applied until accepted", () => {
    const n = s().level.volumes.length;
    s().addProposal(fix);
    expect(s().level.volumes).toHaveLength(n);
    expect(s().proposals).toHaveLength(1);
  });

  it("accept applies with a unique id and resets Prove; the fail preset then passes", () => {
    s().addProposal(fix);
    s().acceptProposal("p1");
    expect(s().proposals).toHaveLength(0);
    expect(vol("cart-2")!.position).toEqual([1.6, 0, -2]); // "cart" already exists in the preset
    expect(s().level.prove?.status).toBe("idle");
    s().runProve();
    expect(s().level.prove?.status).toBe("pass");
  });

  it("reject drops it; update/remove/replaceAll work", () => {
    s().addProposal(fix);
    s().rejectProposal("p1");
    expect(s().proposals).toHaveLength(0);
    s().addProposal({ id: "p2", source: "text", why: "move cart", update: [{ id: "cart", position: [1.6, 0, -2] }], remove: ["hay"] });
    s().acceptProposal("p2");
    expect(vol("cart")!.position).toEqual([1.6, 0, -2]);
    expect(vol("hay")).toBeUndefined();
    s().addProposal({ id: "p3", source: "sketch", why: "from sketch", replaceAll: true, add: [{ id: "spawn", label: "gate", role: "spawn", position: [0, 0, 18], rotationY: 0, size: [2, 0.1, 2] }] });
    s().acceptProposal("p3");
    expect(s().level.volumes.map((v) => v.id)).toEqual(["spawn"]);
  });

  it("only style proposals apply while locked", () => {
    s().loadPreset("market-square-pass");
    s().runProve();
    s().lock();
    s().addProposal(fix);
    s().acceptProposal("p1");
    expect(vol("cart-2")).toBeUndefined();
    s().addProposal({ id: "st", source: "style", why: "from image", styleNotes: "snowy alpine village" });
    s().acceptProposal("st");
    expect(s().level.styleNotes).toBe("snowy alpine village");
  });
});
