// Prebake the hero level: generate every dressable volume of the Market Square presets
// through the local /api/rodin route, using EXACTLY the prompt/key the app computes, so the
// app finds them in public/assets/gen/manifest.json and the public URL needs no live calls.
//
// Usage: start the dev server, then
//   npx tsx scripts/prebake.ts [baseUrl=http://localhost:5173] [--dry]
//   npx tsx scripts/prebake.ts --prune   (delete assets no preset uses; run after a successful prebake)
// Already-generated keys return instantly (no credits).
import { buildPrompt, assetKey } from "../src/core/dress/prompt";
import type { JobResponse } from "../src/core/dress/rodinTypes";
import { DRESS_ROLES, type Volume } from "../src/core/types";
import { PRESETS } from "../src/presets/marketSquare";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:5173";
const dry = process.argv.includes("--dry");

// Unique (prompt, size) across presets. The fail/pass cart differ only in position: same key.
const jobs = new Map<string, { v: Volume; prompt: string }>();
for (const level of PRESETS) {
  for (const v of level.volumes) {
    if (!DRESS_ROLES.includes(v.role)) continue;
    const prompt = buildPrompt(v, level.styleNotes);
    jobs.set(assetKey(prompt, v.size, 0), { v, prompt });
  }
}

if (process.argv.includes("--prune")) {
  // Remove generated assets no preset uses any more (old variants, renamed/resized volumes).
  const { existsSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
  const file = "public/assets/gen/manifest.json";
  const manifest: Record<string, { url: string }> = JSON.parse(readFileSync(file, "utf8"));
  for (const key of Object.keys(manifest)) {
    if (jobs.has(key) || key.startsWith("bot-")) continue; // bot-* = replay runner, not a preset prop
    const glb = `public${manifest[key].url}`;
    if (existsSync(glb)) rmSync(glb);
    delete manifest[key];
    console.log(`pruned ${key}`);
  }
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  process.exit(0);
}

console.log(`${jobs.size} assets to prebake via ${base}${dry ? " (dry run)" : ""}`);
for (const [key, { v }] of jobs) console.log(`  ${key}  ${v.id.padEnd(13)} ${v.size.join("x")}m  ${v.label}`);
if (dry) process.exit(0);

const t0 = Date.now();
const log = (id: string, msg: string) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${id.padEnd(13)} ${msg}`);

async function one(key: string, v: Volume, prompt: string) {
  let job: JobResponse = await (
    await fetch(`${base}/api/rodin/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, prompt, volumeId: v.id }),
    })
  ).json();
  if (!job.status) throw new Error(`generate failed: ${JSON.stringify(job)}`);
  let last = "";
  while (job.status !== "ready" && job.status !== "error") {
    const now = `${job.status} ${job.stage ?? ""}`;
    if (now !== last) log(v.id, now);
    last = now;
    await new Promise((r) => setTimeout(r, 5000));
    job = await (await fetch(`${base}/api/rodin/status?id=${encodeURIComponent(job.jobId)}`)).json();
  }
  log(v.id, job.status === "ready" ? `READY ${job.url}` : `ERROR ${job.error}`);
  return job.status === "ready";
}

const entries = [...jobs.entries()];
let i = 0;
let ok = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (i < entries.length) {
      const [key, { v, prompt }] = entries[i++];
      if (await one(key, v, prompt).catch((e) => (log(v.id, `ERROR ${e}`), false))) ok++;
    }
  }),
);
console.log(`Done: ${ok}/${entries.length} ready in ${Math.round((Date.now() - t0) / 1000)}s`);
