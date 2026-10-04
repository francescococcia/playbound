import { describe, expect, it } from "vitest";
import { marketSquareFail, marketSquarePass } from "../../presets/marketSquare";
import { prove } from "./prove";
import { BOT_SPEED_MPS, replayTimeline, sampleReplay } from "./replay";

describe("playtest replay", () => {
  it("fail preset: the bot is spotted the whole way", () => {
    const r = prove(marketSquareFail);
    const tl = replayTimeline(r)!;
    expect(tl.totalSeconds).toBeGreaterThan(23 / BOT_SPEED_MPS - 0.5);
    expect(tl.spottedSeconds / tl.totalSeconds).toBeGreaterThan(0.95);
    expect(tl.longestExposedSeconds).toBeCloseTo(tl.spottedSeconds, 5);
  });

  it("pass preset: less time spotted, and the longest exposed run is shorter", () => {
    const fail = replayTimeline(prove(marketSquareFail))!;
    const pass = replayTimeline(prove(marketSquarePass))!;
    expect(pass.spottedSeconds).toBeLessThan(fail.spottedSeconds);
    expect(pass.longestExposedSeconds).toBeLessThan(fail.longestExposedSeconds);
  });

  it("samples start at spawn and end at the objective", () => {
    const r = prove(marketSquarePass);
    const tl = replayTimeline(r)!;
    const start = sampleReplay(r, tl, 0);
    const end = sampleReplay(r, tl, tl.totalSeconds + 1);
    expect(Math.hypot(start.x - 0, start.z - 17)).toBeLessThan(0.6);
    expect(Math.hypot(end.x - 0, end.z + 6)).toBeLessThan(0.6);
  });

  it("no route → no replay", () => {
    expect(replayTimeline({ status: "fail", reason: "NO_PATH", path: [] })).toBeNull();
  });
});
