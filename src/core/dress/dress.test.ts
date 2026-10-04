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

  it("marks volumes as error (box stays) when not prebaked, no live route and nothing to stand in", async () => {
    readyLevel();
    fakeFetch((url) => (url.startsWith("/assets/gen/manifest.json") ? json({}) : undefined));
    await dressLevel();
    for (const v of dressable()) {
      expect(v.status).toBe("error");
      expect(v.error).toMatch(/Hyper3D connection/);
      expect(v.assetUrl).toBeUndefined();
    }
  });

  it("public site: a box that isn't prebaked gets the closest prebaked model of its role as a stand-in", async () => {
    readyLevel();
    const { level } = usePlaybound.getState();
    const cart = level.volumes.find((v) => v.id === "cart")!;
    const entry = (url: string, role: string, size: string, extra = {}) => ({
      key: url, volumeId: url, url, generationId: "g", createdAt: "", ...extra,
      prompt: `Gameplay role: ${role} (x).\nExact real-world size: ${size}.\n`,
    });
    const manifest: Record<string, unknown> = {
      far: entry("/assets/gen/far.glb", "cover", "9m wide x 9m tall x 9m deep"),
      near: entry("/assets/gen/near.glb", "cover", `${cart.size[0]}m wide x ${cart.size[1]}m tall x ${cart.size[2]}m deep`),
      photo: entry("/assets/gen/photo.glb", "cover", `${cart.size[0]}m wide x ${cart.size[1]}m tall x ${cart.size[2]}m deep`, { fromImage: true }),
      other: entry("/assets/gen/other.glb", "block", `${cart.size[0]}m wide x ${cart.size[1]}m tall x ${cart.size[2]}m deep`),
    };
    fakeFetch((url) => (url.startsWith("/assets/gen/manifest.json") ? json(manifest) : undefined));
    await dressLevel();
    const after = usePlaybound.getState().level.volumes.find((v) => v.id === "cart")!;
    expect(after.status).toBe("ready");
    expect(after.assetUrl).toBe("/assets/gen/near.glb");
    expect(after.standIn).toBe(true);
    expect(after.size).toEqual(cart.size);
  });

  it("a failed live generation (e.g. expired Hyper3D login) also falls back to a stand-in", async () => {
    readyLevel();
    const manifest = { a: { key: "a", url: "/assets/gen/a.glb", prompt: "Gameplay role: cover (x).\nExact real-world size: 1m wide x 1m tall x 1m deep.\n" } };
    fakeFetch((url) => {
      if (url.startsWith("/assets/gen/manifest.json")) return json(manifest);
      if (url === "/api/rodin/health") return json({ live: true });
      if (url === "/api/rodin/generate") return new Response("no", { status: 500 });
    });
    await dressLevel();
    const cart = usePlaybound.getState().level.volumes.find((v) => v.id === "cart")!;
    expect(cart.status).toBe("ready");
    expect(cart.assetUrl).toBe("/assets/gen/a.glb");
    expect(cart.standIn).toBe(true);
  });

  it("Regenerate never uses a stand-in", async () => {
    readyLevel();
    fakeFetch((url) => (url.startsWith("/assets/gen/manifest.json") ? json({ a: { key: "a", url: "/assets/gen/a.glb", prompt: "Gameplay role: cover (x).\nExact real-world size: 1m wide x 1m tall x 1m deep.\n" } }) : undefined));
    await regenerate("cart");
    const cart = usePlaybound.getState().level.volumes.find((v) => v.id === "cart")!;
    expect(cart.status).toBe("error");
    expect(cart.standIn).toBeUndefined();
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
