import { describe, expect, it } from "vitest";
import type { Level, Proposal, Volume } from "../types";
import { autopilotView } from "./autopilot";

const box = (id: string, role: Volume["role"], status?: Volume["status"]): Volume =>
  ({ id, label: id, role, position: [0, 0, 0], rotationY: 0, size: [1, 1, 1], status }) as Volume;
const level = (patch: Partial<Level> = {}): Level => ({
  id: "l",
  name: "l",
  bounds: 20,
  locked: false,
  volumes: [box("s", "spawn"), box("o", "objective"), box("cart", "cover")],
  ...patch,
});
const ap = { brief: "harbour", layoutProposalId: null as string | null, layoutAccepted: false, styleSet: false };
const passed = { status: "pass" } as Level["prove"];
const failed = { status: "fail" } as Level["prove"];

describe("autopilotView", () => {
  it("starts by offering to draft the layout", () => {
    const v = autopilotView(level(), [], ap);
    expect(v).toMatchObject({ now: "layout", waiting: false, action: "Draft the layout" });
  });

  it("waits while our layout proposal is pending, offers a redraft once dismissed", () => {
    const p = { id: "p1", source: "sketch", why: "", replaceAll: true, add: [] } as Proposal;
    expect(autopilotView(level(), [p], { ...ap, layoutProposalId: "p1" }).waiting).toBe(true);
    expect(autopilotView(level(), [], { ...ap, layoutProposalId: "" }).action).toBe("Redraft the layout");
  });

  it("goes prove → fix (waiting on the fix proposal) → lock", () => {
    const done = { ...ap, layoutAccepted: true };
    expect(autopilotView(level(), [], done).now).toBe("prove");
    expect(autopilotView(level({ prove: failed }), [], done)).toMatchObject({ now: "fix", action: "Ask for a fix" });
    const fix = { id: "f", source: "fix", why: "", add: [box("c2", "cover")] } as Proposal;
    expect(autopilotView(level({ prove: failed }), [fix], done)).toMatchObject({ now: "fix", waiting: true });
    expect(autopilotView(level({ prove: passed }), [], done)).toMatchObject({ now: "lock", action: "Lock the layout" });
  });

  it("then style (old style notes don't count), dress, done", () => {
    const locked = { prove: passed, locked: true };
    const old = level({ ...locked, styleNotes: "medieval market town" });
    expect(autopilotView(old, [], { ...ap, layoutAccepted: true }).now).toBe("style");
    const done = { ...ap, layoutAccepted: true, styleSet: true };
    const styled = { ...locked, styleNotes: "hand-painted harbour" };
    expect(autopilotView(level(styled), [], done)).toMatchObject({ now: "dress", action: "Dress the level" });
    const dressing = level({ ...styled, volumes: [box("s", "spawn"), box("o", "objective"), box("cart", "cover", "generating")] });
    expect(autopilotView(dressing, [], done)).toMatchObject({ now: "dress", waiting: true });
    const dressed = level({ ...styled, volumes: [box("s", "spawn"), box("o", "objective"), box("cart", "cover", "ready")] });
    expect(autopilotView(dressed, [], done).now).toBe("done");
  });
});
