import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { marketSquarePass } from "../../presets/marketSquare";
import { prove } from "../prove/prove";
import type { Level } from "../types";
import { buildExportZip, EXPORT_FORMAT, type ExportedLevel } from "./exportLevel";

describe("export zip", () => {
  it("contains level.json with the contract, GLBs for ready volumes, and a README", async () => {
    const level: Level = structuredClone(marketSquarePass);
    level.prove = prove(level);
    level.locked = true;
    const cart = level.volumes.find((v) => v.id === "cart")!;
    Object.assign(cart, { status: "ready", assetUrl: "/assets/gen/cart.glb", prompt: "a cart" });

    const fetched: string[] = [];
    const blob = await buildExportZip(level, {
      fetchBytes: async (url) => {
        fetched.push(url);
        return new Uint8Array([1, 2, 3]).buffer;
      },
      measure: async () => ({ position: [0, 0.5, 0], rotationY: 0, scale: [0.6, 0.6, 0.6] }),
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(["README.txt", "assets/", "assets/cart.glb", "level.json"]);
    expect(fetched).toEqual(["/assets/gen/cart.glb"]);

    const json = JSON.parse(await zip.file("level.json")!.async("string")) as ExportedLevel;
    expect(json.format).toBe(EXPORT_FORMAT);
    expect(json.volumes).toHaveLength(level.volumes.length);
    expect(json.prove?.status).toBe("pass");
    const c = json.volumes.find((v) => v.id === "cart")!;
    expect(c.position).toEqual(cart.position);
    expect(c.size).toEqual(cart.size);
    expect(c.collider).toBe("box");
    expect(c.asset).toEqual({ file: "assets/cart.glb", transform: { position: [0, 0.5, 0], rotationY: 0, scale: [0.6, 0.6, 0.6] } });
    expect(json.volumes.find((v) => v.id === "tavern")!.asset).toBeUndefined(); // not dressed
  });
});
