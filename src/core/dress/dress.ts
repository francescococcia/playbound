// Dress orchestrator. UI calls dressLevel() and regenerate(id); progress lands on each
// volume via setVolumeAsset (status / stage / assetUrl / error). Never touches transforms.
//
// Where a model comes from, in order:
//   1. Prebaked: public/assets/gen/manifest.json has the cache key -> instant, works on the public URL.
//   2. Live: the local dev route /api/rodin (Hyper3D CLI) -> ~2 min, 0.5 credits.
//   3. Public site, box not prebaked (e.g. an AI-added cover box): the closest prebaked model of the
//      same role stands in (volume.standIn), fitted inside the box like any other.
//   4. Nothing usable -> status "error" with a clear message; the grey box stays (scene never breaks).
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

  await pool(todo.map((v) => () => dressVolume(v.id, undefined, true)), DRESS_CONCURRENCY);
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
/** Image-to-3D from 1–5 photos of the same object (different sides = a more accurate model). */
export async function regenerateFromImage(id: string, image: string | string[]): Promise<void> {
  const images = (Array.isArray(image) ? image : [image]).slice(0, 5);
  const { level, setVolumeAsset } = usePlaybound.getState();
  const v = level.volumes.find((x) => x.id === id);
  if (!v || !DRESS_ROLES.includes(v.role)) return;
  if (!(await isLiveAvailable())) {
    setVolumeAsset(id, { status: "error", error: NO_LIVE_MSG });
    return;
  }
  setVolumeAsset(id, { variant: (v.variant ?? 0) + 1, status: "queued", error: undefined, stage: undefined });
  manifestReq = undefined;
  await dressVolume(id, images);
}

async function dressVolume(id: string, images?: string[], allowStandIn = false): Promise<void> {
  const image = images?.[0];
  const { level, setVolumeAsset } = usePlaybound.getState();
  const v = level.volumes.find((x) => x.id === id) as Volume;
  const base = buildPrompt(v, level.styleNotes);
  const prompt = image ? `${base}
Match the object in the reference ${images!.length > 1 ? `photos (${images!.length} views of the same object)` : "image"} (shape, materials, colours).` : base;
  // The reference image is part of the cache key: same photo + same box = same model.
  const key = assetKey(image ? `${prompt}|img:${hash(images!.join("|"))}` : prompt, v.size, v.variant ?? 0);
  setVolumeAsset(id, { prompt });

  const manifest = await loadManifest();
  if (manifest[key]) {
    setVolumeAsset(id, { status: "ready", assetUrl: manifest[key].url, stage: undefined, standIn: false });
    return;
  }
  // Closest prebaked model, when this box may use one (Dress level, text-to-3D only).
  const standIn = (why?: string) => {
    const stand = allowStandIn && !image ? closestPrebaked(manifest, v) : undefined;
    if (!stand) return false;
    setVolumeAsset(id, { status: "ready", assetUrl: stand.url, stage: undefined, error: why, standIn: true });
    return true;
  };
  if (!(await isLiveAvailable())) {
    if (standIn()) return;
    setVolumeAsset(id, { status: "error", error: NO_LIVE_MSG, stage: undefined });
    return;
  }

  try {
    const body: GenerateRequest = { key, prompt, volumeId: id, size: v.size, ...(image && { image }), ...(images && images.length > 1 && { images }) };
    let job = await postJson<JobResponse>("/api/rodin/generate", body);
    while (job.status !== "ready" && job.status !== "error") {
      setVolumeAsset(id, { status: job.status === "queued" ? "queued" : "generating", stage: job.stage });
      await sleep(POLL_MS);
      job = await getJson<JobResponse>(`/api/rodin/status?id=${encodeURIComponent(job.jobId)}`);
    }
    if (job.status === "error") {
      if (standIn(job.error)) return;
      setVolumeAsset(id, { status: "error", error: job.error ?? "Generation failed", stage: undefined });
    } else {
      setVolumeAsset(id, { status: "ready", assetUrl: job.url, stage: undefined, error: undefined, standIn: false });
    }
  } catch (e) {
    if (standIn(String(e))) return;
    setVolumeAsset(id, { status: "error", error: String(e), stage: undefined });
  }
}

// ---------- stand-ins ----------

const SIZE_RE = /size: ([\d.]+)m wide x ([\d.]+)m tall x ([\d.]+)m deep/;
const ROLE_RE = /Gameplay role: (\w+)/;

/**
 * The prebaked model whose role matches and whose size is closest to the box (sum of |log ratio| per
 * axis). Only text-to-3D entries count: a photo-based model would show somebody else's object.
 * Rodin ignores size anyway and fitToVolume rescales, so a close proportion is what matters.
 */
export function closestPrebaked(manifest: Record<string, ManifestEntry>, v: Volume): ManifestEntry | undefined {
  let best: ManifestEntry | undefined;
  let bestScore = Infinity;
  for (const e of Object.values(manifest)) {
    if (e.fromImage || !e.url) continue;
    const role = ROLE_RE.exec(e.prompt ?? "")?.[1];
    const dims = SIZE_RE.exec(e.prompt ?? "");
    if (role !== v.role || !dims) continue;
    const score = [0, 1, 2].reduce((a, i) => a + Math.abs(Math.log(Math.max(0.05, +dims[i + 1]) / Math.max(0.05, v.size[i]))), 0);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
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
