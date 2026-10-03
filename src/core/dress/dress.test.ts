// Dress orchestrator with a fake server: no network, no credits.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaybound } from "../store";
import { DRESS_ROLES } from "../types";
import { dressLevel, regenerate, regenerateFromImage, resetLiveCheck } from "./dress";
import { assetKey, buildPrompt, hash } from "./prompt";

type Route = (url: string, init?: RequestInit) => Response | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeFetch(route: Route) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => route(url, init) ?? new Response("nf", { status: 404 })));
}

function readyLevel() {
  const s = usePlaybound.getState();
  s.loadPreset("market-square-pass");
  s.runProve();
  s.lock();
  s.setStyleRef("data:image/png;base64,x");
}

const dressable = () => usePlaybound.getState().level.volumes.filter((v) => DRESS_ROLES.includes(v.role));

beforeEach(() => {
  resetLiveCheck();
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("dress", () => {
  it("refuses before Prove pass + Lock", async () => {
    usePlaybound.getState().loadPreset("market-square-fail");
    await expect(dressLevel()).rejects.toThrow(/Prove/);
  });

  it("uses prebaked assets from the manifest (public deploy, no live route)", async () => {
    readyLevel();
    const { level } = usePlaybound.getState();
    const manifest: Record<string, { url: string }> = {};
    for (const v of dressable()) {
      const key = assetKey(buildPrompt(v, level.styleNotes), v.size, 0);
      manifest[key] = { url: `/assets/gen/${key}.glb` };
    }
    fakeFetch((url) => (url.startsWith("/assets/gen/manifest.json") ? json(manifest) : undefined));
    await dressLevel();
    for (const v of dressable()) {
      expect(v.status).toBe("ready");
      expect(v.assetUrl).toMatch(/^\/assets\/gen\/.+\.glb$/);
      expect(v.prompt).toContain(v.label);
    }
  });

  it("marks volumes as error (box stays) when not prebaked and no live route", async () => {
    readyLevel();
    fakeFetch((url) => (url.startsWith("/assets/gen/manifest.json") ? json({}) : undefined));
    await dressLevel();
    for (const v of dressable()) {
      expect(v.status).toBe("error");
      expect(v.error).toMatch(/Hyper3D connection/);
      expect(v.assetUrl).toBeUndefined();
    }
  });

  it("generates live, polls to ready, and never moves the box", async () => {
    readyLevel();
    const before = JSON.stringify(dressable().map((v) => [v.position, v.size, v.rotationY]));
    const polls = new Map<string, number>();
    fakeFetch((url, init) => {
      if (url.startsWith("/assets/gen/manifest.json")) return json({});
      if (url === "/api/rodin/health") return json({ live: true });
      if (url === "/api/rodin/generate") {
        const { key } = JSON.parse(String(init?.body));
        return json({ jobId: key, status: "queued" });
      }
      if (url.startsWith("/api/rodin/status")) {
        const id = new URL(url, "http://x").searchParams.get("id")!;
        const n = (polls.get(id) ?? 0) + 1;
        polls.set(id, n);
        return json(n < 2 ? { jobId: id, status: "generating", stage: "mesh 2/5" } : { jobId: id, status: "ready", url: `/assets/gen/${id}.glb` });
      }
    });
    const done = dressLevel();
    await vi.runAllTimersAsync();
    await done;
    for (const v of dressable()) expect(v.status).toBe("ready");
    expect(JSON.stringify(dressable().map((v) => [v.position, v.size, v.rotationY]))).toBe(before);
  });

  it("regenerate bumps the variant (new cache key) and keeps the old model meanwhile", async () => {
    readyLevel();
    const s = usePlaybound.getState();
    s.setVolumeAsset("cart", { status: "ready", assetUrl: "/assets/gen/old.glb" });
    let seenKey = "";
    fakeFetch((url, init) => {
      if (url.startsWith("/assets/gen/manifest.json")) return json({});
      if (url === "/api/rodin/health") return json({ live: true });
      if (url === "/api/rodin/generate") {
        seenKey = JSON.parse(String(init?.body)).key;
        expect(usePlaybound.getState().level.volumes.find((v) => v.id === "cart")!.assetUrl).toBe("/assets/gen/old.glb");
        return json({ jobId: "j1", status: "ready", url: "/assets/gen/new.glb" });
      }
    });
    await regenerate("cart");
    const cart = usePlaybound.getState().level.volumes.find((v) => v.id === "cart")!;
    expect(cart.variant).toBe(1);
    expect(cart.assetUrl).toBe("/assets/gen/new.glb");
    expect(seenKey).toBe(assetKey(cart.prompt!, cart.size, 1));
  });

  it("regenerateFromImage sends the reference image; the image is part of the cache key", async () => {
    readyLevel();
    const img = "data:image/jpeg;base64,/9j/AAAA";
    let sent: any;
    fakeFetch((url, init) => {
      if (url.startsWith("/assets/gen/manifest.json")) return json({});
      if (url === "/api/rodin/health") return json({ live: true });
      if (url === "/api/rodin/generate") {
        sent = JSON.parse(String(init?.body));
        return json({ jobId: "j2", status: "ready", url: "/assets/gen/photo.glb" });
      }
    });
    await regenerateFromImage("cart", img);
    const cart = usePlaybound.getState().level.volumes.find((v) => v.id === "cart")!;
    expect(sent.image).toBe(img);
    expect(sent.prompt).toMatch(/reference image/);
    expect(sent.key).toBe(assetKey(`${sent.prompt}|img:${hash(img)}`, cart.size, 1));
    expect(cart.assetUrl).toBe("/assets/gen/photo.glb");
    expect(cart.status).toBe("ready");
  });

  it("regenerateFromImage on the public site (no live route) reports the error", async () => {
    readyLevel();
    fakeFetch((url) => (url.startsWith("/assets/gen/manifest.json") ? json({}) : undefined));
    await regenerateFromImage("cart", "data:image/jpeg;base64,/9j/AAAA");
    const cart = usePlaybound.getState().level.volumes.find((v) => v.id === "cart")!;
    expect(cart.status).toBe("error");
    expect(cart.error).toMatch(/Hyper3D connection/);
  });
});
