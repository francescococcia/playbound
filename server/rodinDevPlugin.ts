// Dev-only Vite middleware: /api/rodin/* -> Hyper3D CLI (OAuth login, account credits).
// Why the CLI: the Rodin HTTP API needs the Business plan. The CLI uses `hyper3d auth login`.
// Only runs under `vite dev` (apply: "serve"). The public build has no /api/rodin, and the
// client falls back to prebaked assets.
//
//   GET  /api/rodin/health          -> { live: true }
//   POST /api/rodin/generate        -> JobResponse   body: GenerateRequest (cached by key;
//                                      optional `image` = reference photo -> image-to-3D)
//   GET  /api/rodin/status?id=<id>  -> JobResponse
//
// Pipeline per job: generate -> poll status -> result -> download PBR GLB
//   -> gltf-transform optimize (simplify + meshopt + 1K webp, ~28 MB -> ~1 MB)
//   -> public/assets/gen/<key>.glb + manifest.json entry.
import { execFile, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";
import type { GenerateRequest, JobResponse, ManifestEntry } from "../src/core/dress/rodinTypes.ts";
import { apiDownloadList, apiGenerate, apiStatus } from "./rodinApi.ts";

const ROOT = resolve(process.cwd());
const GEN_DIR = join(ROOT, "public", "assets", "gen");
const RAW_DIR = join(ROOT, "cache", "raw");
const REF_DIR = join(ROOT, "cache", "ref");
const MANIFEST = join(GEN_DIR, "manifest.json");
/** Faces requested from Rodin. Lower = faster download; we simplify further anyway. */
const RODIN_QUALITY = "50000";
const BUILDING_HINT =
  "ONE single building as one connected volume that fills the box: not a complex, campus or group of buildings. No landscaping, lawns, trees, roads, paving, fences or ground slab around it.";

interface Job {
  jobId: string; // Rodin generation id
  key: string;
  volumeId: string;
  prompt: string;
  status: JobResponse["status"];
  fromImage?: boolean;
  stage?: string;
  url?: string;
  error?: string;
  finalizing?: boolean;
  /** Building-sized box (≥ 6 m wide): sharper textures and more geometry kept. */
  big?: boolean;
  /** Set when the job runs through the HTTP API (BBOX control) instead of the CLI. */
  api?: { uuid: string; subscriptionKey: string };
}

const jobs = new Map<string, Job>();
/** Hyper3D API key (Business). When set, generation uses the API with bbox_condition. */
let apiKey: string | undefined;

export function rodinDevPlugin(key?: string): Plugin {
  apiKey = key || undefined;
  return {
    name: "playbound-rodin-dev",
    apply: "serve",
    configureServer(server) {
      mkdirSync(GEN_DIR, { recursive: true });
      mkdirSync(RAW_DIR, { recursive: true });
      mkdirSync(REF_DIR, { recursive: true });
      server.middlewares.use("/api/rodin", (req, res) => {
        handle(req, res).catch((e: unknown) => send(res, 500, { error: String(e) }));
      });
    },
  };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://local");
  if (url.pathname === "/health") return send(res, 200, { live: true, via: apiKey ? "api" : "cli" });

  if (url.pathname === "/generate" && req.method === "POST") {
    const body = JSON.parse(await readBody(req)) as GenerateRequest;
    const file = join(GEN_DIR, `${body.key}.glb`);
    if (existsSync(file)) {
      return send(res, 200, { jobId: `cached-${body.key}`, status: "ready", url: publicUrl(body.key) } satisfies JobResponse);
    }
    const running = [...jobs.values()].find((j) => j.key === body.key && j.status !== "error");
    if (running) return send(res, 200, view(running));

    // Big boxes: Rodin otherwise tends to make a whole "site" (several buildings, lawns, a slab).
    // Added here, not in the shared prompt, so cached keys (prebaked presets) stay valid.
    const big = !!body.size && Math.max(body.size[0], body.size[2]) >= 6;
    const prompt = big && !body.image ? `${body.prompt}
${BUILDING_HINT}` : body.prompt;
    // `generationId` adopts an existing Rodin generation (made via MCP or the website): no new credits.
    let generationId = body.generationId;
    if (!generationId && apiKey) {
      // HTTP API with BBOX control: Rodin generates to the box's proportions.
      const images: { data: Buffer; mime: string; name: string }[] = [];
      for (const [i, url] of (body.images ?? (body.image ? [body.image] : [])).entries()) {
        const m = /^data:(image\/(\w+));base64,(.+)$/.exec(url);
        if (!m) return send(res, 400, { jobId: "", status: "error", error: "Reference must be an image data URL" } satisfies JobResponse);
        images.push({ data: Buffer.from(m[3], "base64"), mime: m[1], name: `${body.key}-${i}.${m[2] === "jpeg" ? "jpg" : m[2]}` });
      }
      const task = await apiGenerate(apiKey, { prompt, size: body.size, images, quality: Number(RODIN_QUALITY) });
      const job: Job = { jobId: task.uuid, key: body.key, volumeId: body.volumeId, prompt: body.prompt, status: "queued", fromImage: !!body.image, big, api: task };
      jobs.set(job.jobId, job);
      return send(res, 200, view(job));
    }
    if (!generationId) {
      const args = ["generate", "--prompt", prompt, "--format", "glb", "--quality", RODIN_QUALITY];
      if (body.image) {
        // Image-to-3D: the CLI takes a local file path.
        const m = /^data:image\/(\w+);base64,(.+)$/.exec(body.image);
        if (!m) return send(res, 400, { jobId: "", status: "error", error: "Reference must be an image data URL" } satisfies JobResponse);
        const ref = join(REF_DIR, `${body.key}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
        writeFileSync(ref, Buffer.from(m[2], "base64"));
        args.push("--image", ref);
      }
      const out = await cli(args);
      generationId = out?.generation_id;
      if (!generationId) {
        return send(res, 502, { jobId: "", status: "error", error: `Hyper3D CLI gave no generation id: ${JSON.stringify(out).slice(0, 300)}` } satisfies JobResponse);
      }
    }
    const job: Job = { jobId: generationId, key: body.key, volumeId: body.volumeId, prompt: body.prompt, status: "queued", fromImage: !!body.image, big };
    jobs.set(job.jobId, job);
    return send(res, 200, view(job));
  }

  if (url.pathname === "/status") {
    const id = url.searchParams.get("id") ?? "";
    if (id.startsWith("cached-")) {
      const key = id.slice(7);
      return send(res, 200, { jobId: id, status: "ready", url: publicUrl(key) } satisfies JobResponse);
    }
    const job = jobs.get(id);
    if (!job) return send(res, 404, { jobId: id, status: "error", error: "Unknown job (dev server restarted?)" } satisfies JobResponse);
    if (job.status === "queued" || job.status === "generating") await refresh(job);
    return send(res, 200, view(job));
  }

  send(res, 404, { error: "not found" });
}

async function refresh(job: Job) {
  if (job.api) {
    const s = await apiStatus(apiKey!, job.api.subscriptionKey);
    job.stage = s.state === "generating" ? "Generating 3D" : undefined; // s.detail ("jobs 1/6") is API-internal
    if (s.state === "failed") [job.status, job.error] = ["error", "Rodin job failed"];
    else if (s.state === "done") startFinalize(job);
    else job.status = s.state === "waiting" ? "queued" : "generating";
    return;
  }
  const s = await cli(["status", job.jobId]);
  if (s.stage) job.stage = `${s.stage.name} ${s.stage.current}/${s.stage.total}`;
  if (s.status === "completed") {
    startFinalize(job);
  } else if (/fail|error|cancel/i.test(String(s.status))) {
    job.status = "error";
    job.error = `Rodin status: ${s.status}`;
  } else {
    job.status = s.status === "queued" ? "queued" : "generating";
  }
}

function startFinalize(job: Job) {
  job.status = "processing";
  job.stage = "optimizing";
  if (job.finalizing) return;
  job.finalizing = true;
  finalize(job).catch((e: unknown) => {
    job.status = "error";
    job.error = `Post-processing failed: ${String(e)}`;
  });
}

async function finalize(job: Job) {
  const files: { name: string; url: string }[] = job.api
    ? await apiDownloadList(apiKey!, job.api.uuid)
    : ((await cli(["result", job.jobId])).files ?? []);
  const pick = files.find((f) => f.name.includes("pbr") && f.name.endsWith(".glb")) ?? files.find((f) => f.name.endsWith(".glb"));
  if (!pick) throw new Error("No GLB in Rodin result");

  const raw = join(RAW_DIR, `${job.key}.glb`);
  const resp = await fetch(pick.url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  writeFileSync(raw, Buffer.from(await resp.arrayBuffer()));

  const out = join(GEN_DIR, `${job.key}.glb`);
  await run(process.execPath, [
    gltfTransformEntry(), "optimize", raw, out,
    // Buildings are seen up close in Walk mode: 2K textures, keep 15% of the geometry (props: 1K, 5%).
    "--texture-size", job.big ? "2048" : "1024", "--texture-compress", "webp",
    "--simplify-ratio", job.big ? "0.15" : "0.05", "--simplify-error", job.big ? "0.002" : "0.005",
    "--compress", "meshopt",
  ]);

  const entry: ManifestEntry = {
    key: job.key,
    volumeId: job.volumeId,
    prompt: job.prompt,
    generationId: job.jobId,
    url: publicUrl(job.key),
    createdAt: new Date().toISOString(),
    ...(job.fromImage && { fromImage: true }),
  };
  const manifest: Record<string, ManifestEntry> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  manifest[job.key] = entry;
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  job.url = entry.url;
  job.stage = undefined;
  job.status = "ready";
}

// ---------- helpers ----------

function view(j: Job): JobResponse {
  return { jobId: j.jobId, status: j.status, stage: j.stage, url: j.url, error: j.error };
}

function publicUrl(key: string) {
  return `/assets/gen/${key}.glb`;
}

let hyper3dEntry: string | undefined;
function hyper3dCliEntry(): string {
  if (process.env.HYPER3D_CLI) return process.env.HYPER3D_CLI;
  if (hyper3dEntry) return hyper3dEntry;
  const rel = join("@hyper3d", "cli", "dist", "index.js");
  const nodeDir = dirname(process.execPath);
  // Global packages live next to node.exe on Windows (nvm/standard installer), in ../lib on Unix.
  const candidates = [join(nodeDir, "node_modules", rel), join(nodeDir, "..", "lib", "node_modules", rel)];
  let found = candidates.find((p) => existsSync(p));
  if (!found) {
    try {
      found = join(execSync("npm root -g", { encoding: "utf8" }).trim(), rel);
    } catch {
      /* npm not on PATH for this process */
    }
  }
  if (!found || !existsSync(found)) throw new Error("Hyper3D CLI not found. Run: npm install --global @hyper3d/cli (or set HYPER3D_CLI)");
  return (hyper3dEntry = found);
}

function gltfTransformEntry(): string {
  const dir = join(ROOT, "node_modules", "@gltf-transform", "cli");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin["gltf-transform"];
  return join(dir, bin);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cli(args: string[]): Promise<any> {
  const stdout = await run(process.execPath, [hyper3dCliEntry(), "--output", "json", ...args]);
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Hyper3D CLI returned non-JSON: ${stdout.slice(0, 300)}`);
  }
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((ok, fail) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) fail(new Error(`${err.message}\n${stderr}`.trim()));
      else ok(stdout);
    });
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let s = "";
    req.on("data", (d) => (s += d));
    req.on("end", () => ok(s));
    req.on("error", fail);
  });
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
