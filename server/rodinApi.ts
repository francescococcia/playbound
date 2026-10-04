// Hyper3D Rodin HTTP API (Gen-2.5) with BBOX control: the model is generated to the
// contract box's proportions. Used by the dev route when HYPER3D_API_KEY is set; the
// Hyper3D CLI stays as the fallback. Key is server-only (Authorization header).
const BASE = "https://api.hyper3d.com/api/v2";

/** Box size in metres → bbox_condition integers (cm, scaled down to fit the 2048 limit). */
export function bboxCondition(size: [number, number, number]): [number, number, number] {
  const cm = size.map((m) => Math.max(1, m * 100));
  const k = Math.min(1, 2048 / Math.max(...cm));
  return cm.map((n) => Math.max(1, Math.min(2048, Math.round(n * k)))) as [number, number, number];
}

export interface ApiTask {
  /** Top-level uuid: used for /download. */
  uuid: string;
  /** jobs.subscription_key: used for /status. */
  subscriptionKey: string;
}

export async function apiGenerate(
  key: string,
  opts: { prompt: string; size?: [number, number, number]; images?: { data: Buffer; mime: string; name: string }[]; quality: number },
): Promise<ApiTask> {
  const form = new FormData();
  form.append("tier", "Gen-2.5-Medium");
  form.append("prompt", opts.prompt);
  form.append("geometry_file_format", "glb");
  form.append("material", "PBR");
  form.append("quality_override", String(opts.quality));
  if (opts.size) for (const n of bboxCondition(opts.size)) form.append("bbox_condition", String(n));
  // Several views of the same object: Rodin fuses them into one model (max 5).
  for (const img of (opts.images ?? []).slice(0, 5)) form.append("images", new Blob([new Uint8Array(img.data)], { type: img.mime }), img.name);
  const r = await fetch(`${BASE}/rodin`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string; uuid?: string; jobs?: { subscription_key?: string } };
  if (!r.ok || j.error || !j.uuid || !j.jobs?.subscription_key) {
    throw new Error(`Rodin API: ${r.status} ${j.error ?? ""} ${j.message ?? ""}`.trim());
  }
  return { uuid: j.uuid, subscriptionKey: j.jobs.subscription_key };
}

/** Overall state of a task: done when every job is Done; failed if any job Failed. */
export async function apiStatus(key: string, subscriptionKey: string): Promise<{ state: "waiting" | "generating" | "done" | "failed"; detail: string }> {
  const r = await fetch(`${BASE}/status`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ subscription_key: subscriptionKey }),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: string; jobs?: { status?: string }[] };
  if (!r.ok || j.error) throw new Error(`Rodin status: ${r.status} ${j.error ?? ""}`.trim());
  const states = (j.jobs ?? []).map((x) => x.status ?? "");
  const done = states.filter((s) => s === "Done").length;
  const detail = `jobs ${done}/${states.length}`;
  if (states.some((s) => s === "Failed")) return { state: "failed", detail };
  if (states.length && done === states.length) return { state: "done", detail };
  if (states.some((s) => s === "Generating")) return { state: "generating", detail };
  return { state: "waiting", detail };
}

export async function apiDownloadList(key: string, uuid: string): Promise<{ name: string; url: string }[]> {
  const r = await fetch(`${BASE}/download`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ task_uuid: uuid }),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: string; list?: { name: string; url: string }[] };
  if (!r.ok || j.error) throw new Error(`Rodin download: ${r.status} ${j.error ?? ""}`.trim());
  return j.list ?? [];
}
