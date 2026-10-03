// Dress orchestrator. UI calls dressLevel() and regenerate(id); progress lands on each
// volume via setVolumeAsset (status / stage / assetUrl / error). Never touches transforms.
//
// Where a model comes from, in order:
//   1. Prebaked: public/assets/gen/manifest.json has the cache key -> instant, works on the public URL.
//   2. Live: the local dev route /api/rodin (Hyper3D CLI) -> ~2 min, 0.5 credits.
//   3. Neither -> status "error" with a clear message; the grey box stays (scene never breaks).
import { canDress, usePlaybound } from "../store";
import { DRESS_ROLES, type Volume } from "../types";
import { assetKey, buildPrompt, hash } from "./prompt";
import type { GenerateRequest, JobResponse, ManifestEntry } from "./rodinTypes";

export const DRESS_CONCURRENCY = 3;
const POLL_MS = 5000;
const NO_LIVE_MSG = "Live generation needs a Hyper3D connection (run the app locally).";

let liveCheck: Promise<boolean> | undefined;
/** Test hook: forget the cached health check. */
export function resetLiveCheck() {
  liveCheck = undefined;
  manifestReq = undefined;
}
/** True when the local /api/rodin route exists (dev server with the Hyper3D CLI). */
export function isLiveAvailable(): Promise<boolean> {
  liveCheck ??= fetch("/api/rodin/health")
    .then(async (r) => r.ok && (await r.json()).live === true)
    .catch(() => false);
  return liveCheck;
}

// One fetch per Dress run / Regenerate, shared by all volumes in it.
let manifestReq: Promise<Record<string, ManifestEntry>> | undefined;
function loadManifest(): Promise<Record<string, ManifestEntry>> {
  manifestReq ??= fetch("/assets/gen/manifest.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return manifestReq;
}

/** Dress every cover/block/landmark/prop that isn't ready yet. Resolves when all have settled. */
export async function dressLevel(): Promise<void> {
  const { level } = usePlaybound.getState();
  const gate = canDress(level);
  if (!gate.ok) throw new Error(gate.why);

  const todo = level.volumes.filter((v) => DRESS_ROLES.includes(v.role) && v.status !== "ready");
  const set = usePlaybound.getState().setVolumeAsset;
  for (const v of todo) set(v.id, { status: "queued", error: undefined, stage: undefined });
  manifestReq = undefined;

  await pool(todo.map((v) => () => dressVolume(v.id)), DRESS_CONCURRENCY);
}

/** New variant for one volume (live only, unless that variant was prebaked). */
export async function regenerate(id: string): Promise<void> {
  const { level, setVolumeAsset } = usePlaybound.getState();
  const v = level.volumes.find((x) => x.id === id);
  if (!v || !DRESS_ROLES.includes(v.role)) return;
  const variant = (v.variant ?? 0) + 1;
  // assetUrl is left as is, so the current model stays visible while the new one generates.
  setVolumeAsset(id, { variant, status: "queued", error: undefined, stage: undefined });
  manifestReq = undefined;
  await dressVolume(id);
}

/**
 * Rodin image-to-3D for one box: a photo or sketch of the object (e.g. a real well) plus the
 * usual prompt. The model is still fitted inside the box. Live (local) only: ~2 min, 0.5 credits.
 * `image` = a JPEG/PNG data URL (use toJpegDataUrl from ../image for File uploads).
 */
export async function regenerateFromImage(id: string, image: string): Promise<void> {
  const { level, setVolumeAsset } = usePlaybound.getState();
  const v = level.volumes.find((x) => x.id === id);
  if (!v || !DRESS_ROLES.includes(v.role)) return;
  if (!(await isLiveAvailable())) {
    setVolumeAsset(id, { status: "error", error: NO_LIVE_MSG });
    return;
  }
  setVolumeAsset(id, { variant: (v.variant ?? 0) + 1, status: "queued", error: undefined, stage: undefined });
  manifestReq = undefined;
  await dressVolume(id, image);
}

async function dressVolume(id: string, image?: string): Promise<void> {
  const { level, setVolumeAsset } = usePlaybound.getState();
  const v = level.volumes.find((x) => x.id === id) as Volume;
  const base = buildPrompt(v, level.styleNotes);
  const prompt = image ? `${base}
Match the object in the reference image (shape, materials, colours).` : base;
  // The reference image is part of the cache key: same photo + same box = same model.
  const key = assetKey(image ? `${prompt}|img:${hash(image)}` : prompt, v.size, v.variant ?? 0);
  setVolumeAsset(id, { prompt });

  const manifest = await loadManifest();
  if (manifest[key]) {
    setVolumeAsset(id, { status: "ready", assetUrl: manifest[key].url, stage: undefined });
    return;
  }
  if (!(await isLiveAvailable())) {
    setVolumeAsset(id, { status: "error", error: NO_LIVE_MSG, stage: undefined });
    return;
  }

  try {
    const body: GenerateRequest = { key, prompt, volumeId: id, ...(image && { image }) };
    let job = await postJson<JobResponse>("/api/rodin/generate", body);
    while (job.status !== "ready" && job.status !== "error") {
      setVolumeAsset(id, { status: job.status === "queued" ? "queued" : "generating", stage: job.stage });
      await sleep(POLL_MS);
      job = await getJson<JobResponse>(`/api/rodin/status?id=${encodeURIComponent(job.jobId)}`);
    }
    if (job.status === "error") {
      setVolumeAsset(id, { status: "error", error: job.error ?? "Generation failed", stage: undefined });
    } else {
      setVolumeAsset(id, { status: "ready", assetUrl: job.url, stage: undefined, error: undefined });
    }
  } catch (e) {
    setVolumeAsset(id, { status: "error", error: String(e), stage: undefined });
  }
}

// ---------- helpers ----------

async function pool(tasks: (() => Promise<void>)[], n: number): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) await tasks[i++]();
  };
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, worker));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok && r.status !== 404) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
