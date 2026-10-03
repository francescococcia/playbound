// Dev-only Vite middleware: /api/rodin/* -> Hyper3D CLI (OAuth login, account credits).
// Why the CLI: the Rodin HTTP API needs the Business plan. The CLI uses `hyper3d auth login`.
// Only runs under `vite dev` (apply: "serve"). The public build has no /api/rodin, and the
// client falls back to prebaked assets.
//
//   GET  /api/rodin/health          -> { live: true }
//   POST /api/rodin/generate        -> JobResponse   body: GenerateRequest (cached by key)
//   GET  /api/rodin/status?id=<id>  -> JobResponse
//
// Pipeline per job: generate -> poll status -> result -> download PBR GLB
//   -> gltf-transform optimize (simplify + meshopt + 1K webp, ~28 MB -> ~1 MB)
//   -> public/assets/gen/<key>.glb + manifest.json entry.
import { execFile, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import type { GenerateRequest, JobResponse, ManifestEntry } from "../src/core/dress/rodinTypes.ts";

const ROOT = resolve(process.cwd());
const GEN_DIR = join(ROOT, "public", "assets", "gen");
const RAW_DIR = join(ROOT, "cache", "raw");
const MANIFEST = join(GEN_DIR, "manifest.json");
/** Faces requested from Rodin. Lower = faster download; we simplify further anyway. */
const RODIN_QUALITY = "50000";

interface Job {
  jobId: string; // Rodin generation id
  key: string;
  volumeId: string;
  prompt: string;
  status: JobResponse["status"];
  stage?: string;
  url?: string;
  error?: string;
  finalizing?: boolean;
}

const jobs = new Map<string, Job>();

export function rodinDevPlugin(): Plugin {
  return {
    name: "playbound-rodin-dev",
    apply: "serve",
    configureServer(server) {
      mkdirSync(GEN_DIR, { recursive: true });
      mkdirSync(RAW_DIR, { recursive: true });
      server.middlewares.use("/api/rodin", (req, res) => {
        handle(req, res).catch((e: unknown) => send(res, 500, { error: String(e) }));
      });
    },
  };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://local");
  if (url.pathname === "/health") return send(res, 200, { live: true });

  if (url.pathname === "/generate" && req.method === "POST") {
    const body = JSON.parse(await readBody(req)) as GenerateRequest;
    const file = join(GEN_DIR, `${body.key}.glb`);
    if (existsSync(file)) {
      return send(res, 200, { jobId: `cached-${body.key}`, status: "ready", url: publicUrl(body.key) } satisfies JobResponse);
    }
    const running = [...jobs.values()].find((j) => j.key === body.key && j.status !== "error");
    if (running) return send(res, 200, view(running));

    // `generationId` adopts an existing Rodin generation (made via MCP or the website): no new credits.
    let generationId = body.generationId;
    if (!generationId) {
      const out = await cli(["generate", "--prompt", body.prompt, "--format", "glb", "--quality", RODIN_QUALITY]);
      generationId = out?.generation_id;
      if (!generationId) {
        return send(res, 502, { jobId: "", status: "error", error: `Hyper3D CLI gave no generation id: ${JSON.stringify(out).slice(0, 300)}` } satisfies JobResponse);
      }
    }
    const job: Job = { jobId: generationId, key: body.key, volumeId: body.volumeId, prompt: body.prompt, status: "queued" };
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
  const s = await cli(["status", job.jobId]);
  if (s.stage) job.stage = `${s.stage.name} ${s.stage.current}/${s.stage.total}`;
  if (s.status === "completed") {
    job.status = "processing";
    job.stage = "optimizing";
    if (!job.finalizing) {
      job.finalizing = true;
      finalize(job).catch((e: unknown) => {
        job.status = "error";
        job.error = `Post-processing failed: ${String(e)}`;
      });
    }
  } else if (/fail|error|cancel/i.test(String(s.status))) {
    job.status = "error";
    job.error = `Rodin status: ${s.status}`;
  } else {
    job.status = s.status === "queued" ? "queued" : "generating";
  }
}

async function finalize(job: Job) {
  const r = await cli(["result", job.jobId]);
  const files: { name: string; url: string; role?: string }[] = r.files ?? [];
  const pick = files.find((f) => f.name.includes("pbr") && f.name.endsWith(".glb")) ?? files.find((f) => f.name.endsWith(".glb"));
  if (!pick) throw new Error("No GLB in Rodin result");

  const raw = join(RAW_DIR, `${job.key}.glb`);
  const resp = await fetch(pick.url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  writeFileSync(raw, Buffer.from(await resp.arrayBuffer()));

  const out = join(GEN_DIR, `${job.key}.glb`);
  await run(process.execPath, [
    gltfTransformEntry(), "optimize", raw, out,
    "--texture-size", "1024", "--texture-compress", "webp",
    "--simplify-ratio", "0.05", "--simplify-error", "0.005",
    "--compress", "meshopt",
  ]);

  const entry: ManifestEntry = {
    key: job.key,
    volumeId: job.volumeId,
    prompt: job.prompt,
    generationId: job.jobId,
    url: publicUrl(job.key),
    createdAt: new Date().toISOString(),
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
  if (!hyper3dEntry) {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    hyper3dEntry = join(root, "@hyper3d", "cli", "dist", "index.js");
    if (!existsSync(hyper3dEntry)) throw new Error("Hyper3D CLI not found. Run: npm install --global @hyper3d/cli");
  }
  return hyper3dEntry;
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
