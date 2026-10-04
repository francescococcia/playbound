import { describe, expect, it } from "vitest";
import { marketSquarePass } from "../presets/marketSquare";
import { decodeLevel, deleteSave, editorUrlFromPlay, encodeLevel, isPlayLink, levelFromUrl, listSaves, loadSave, playUrl, saveLevel, shareUrl } from "./share";
import type { Level } from "./types";

const dressed = (): Level => {
  const l = structuredClone(marketSquarePass);
  const cart = l.volumes.find((v) => v.id === "cart")!;
  Object.assign(cart, { status: "ready", assetUrl: "/assets/gen/c42f0463.glb", prompt: "a cart", stage: "x" });
  l.styleRefUrl = "data:image/png;base64," + "A".repeat(50_000);
  return l;
};

describe("share links", () => {
  it("round-trips the layout, keeps prebaked assets, drops transient + style image", async () => {
    const code = await encodeLevel(dressed());
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(2500); // fits comfortably in a URL
    const back = await decodeLevel(code);
    expect(back.volumes.map((v) => v.id)).toEqual(marketSquarePass.volumes.map((v) => v.id));
    expect(back.volumes.find((v) => v.id === "tavern")!.size).toEqual([9, 7, 8]);
    const cart = back.volumes.find((v) => v.id === "cart")!;
    expect(cart.assetUrl).toBe("/assets/gen/c42f0463.glb");
    expect(cart.stage).toBeUndefined();
    expect(back.styleRefUrl).toBeUndefined();
    expect(back.styleNotes).toBe(marketSquarePass.styleNotes);
    expect(back.prove?.status).toBe("idle");
  });

  it("builds a #l= URL and reads it back; junk → null", async () => {
    const url = await shareUrl(dressed(), "https://x.app/");
    expect(url.startsWith("https://x.app/#l=")).toBe(true);
    const l = await levelFromUrl(new URL(url).hash);
    expect(l?.name).toBe(marketSquarePass.name);
    expect(await levelFromUrl("#l=garbage")).toBeNull();
    expect(await levelFromUrl("")).toBeNull();
  });
});

describe("saves", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it("save, list (newest first, overwrite by id), load, delete", () => {
    const s = mem();
    const a = dressed();
    const b = { ...dressed(), id: "other", name: "Other" };
    expect(saveLevel(a, s)).toBe(true);
    saveLevel(b, s);
    saveLevel(a, s); // overwrite → moves to the top
    expect(listSaves(s).map((e) => e.id)).toEqual([a.id, "other"]);
    expect(loadSave("other", s)?.name).toBe("Other");
    deleteSave("other", s);
    expect(listSaves(s)).toHaveLength(1);
    expect(loadSave("nope", s)).toBeNull();
  });

  it("returns false when storage is unavailable", () => {
    expect(saveLevel(dressed(), null)).toBe(false);
    expect(listSaves(null)).toEqual([]);
  });
});

describe("play links", () => {
  it("#play&l= opens the same level; detects play mode; converts to an editor link", async () => {
    const url = await playUrl(dressed(), "https://x.app/");
    expect(url.startsWith("https://x.app/#play&l=")).toBe(true);
    const hash = new URL(url).hash;
    expect(isPlayLink(hash)).toBe(true);
    expect(isPlayLink("#l=abc")).toBe(false);
    expect((await levelFromUrl(hash))?.name).toBe(marketSquarePass.name);
    expect(editorUrlFromPlay(url)).toBe(url.replace("#play&", "#"));
  });
});
