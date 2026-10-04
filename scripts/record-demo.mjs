// Records the PLAYBOUND demo walkthrough as a video, driving the real app in a visible browser.
//
//   npm run dev                                   (in one terminal)
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/record-demo.mjs [url] [--pass]   (in another; default http://localhost:5173)
//
// --pass starts from the "Market Square (pass)" preset and skips Suggest fix, so every box is prebaked
// and nothing depends on what Gemini proposes. Without it the cover box the AI adds gets a stand-in model.
//
// Output: recordings/raw/*.webm (convert: ffmpeg -i x.webm -c:v libx264 -pix_fmt yuv420p demo.mp4).
// Needs the Gemini key in .env for the Suggest fix and style-notes steps. Dress uses the prebaked models.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const PASS = args.includes("--pass");
const URL = args.find((a) => !a.startsWith("--")) ?? "http://localhost:5173";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styleImage = path.join(root, "demo", "guildhall-photo.jpg");

const browser = await chromium.launch({ headless: false, args: ["--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: path.join(root, "recordings", "raw"), size: { width: 1440, height: 900 } },
  acceptDownloads: true,
});
const p = await ctx.newPage();

const wait = (ms) => p.waitForTimeout(ms);
const click = (name, timeout = 20000) => p.getByRole("button", { name }).first().click({ timeout });
const cap = (text) =>
  p.evaluate((t) => {
    let e = document.getElementById("__cap");
    if (!e) {
      e = document.createElement("div");
      e.id = "__cap";
      e.style.cssText =
        "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:rgba(10,12,20,.88);color:#fff;font:600 20px Inter,system-ui,sans-serif;padding:10px 22px;border-radius:12px;border:1px solid rgba(255,255,255,.2);pointer-events:none;max-width:1000px;text-align:center";
      document.body.appendChild(e);
    }
    e.textContent = t;
  }, text);

await p.goto(URL);
await wait(5000);
await cap("PLAYBOUND: prove the greybox, then dress it. AI that cannot break your level design.");
await wait(4500);
await cap("1 · Contract: a greybox level, every box has a role and an exact size");
await wait(3500);
await cap("2 · Prove: a bot walks spawn → objective, line of sight checks the cover");
if (PASS) {
  await p.locator("select").first().selectOption({ label: "Market Square (pass)" });
  await wait(1500);
}
await click("Run Prove");
await wait(6500);
if (PASS) {
  await cap("PASS: the route is protected by cover, so the layout can be locked");
  await wait(3500);
} else {
  await cap("FAIL: death corridor, 0% of the route is protected");
  await wait(3500);
  await cap('AI "Suggest fix" proposes cover, re-checked by Prove before you see it');
  await click(/Suggest fix/);
  await wait(16000);
  await cap("Accept the proposal → Prove re-runs → PASS");
  await click("Accept");
  await wait(7000);
}
await cap("3 · Lock: only a passing layout can be locked");
await click(/Lock layout/);
await wait(3500);
await cap("4 · Dress: a style image becomes style notes (AI)");
const [chooser] = await Promise.all([p.waitForEvent("filechooser"), click(/Add reference image/)]);
await chooser.setFiles(styleImage);
await wait(12000);
await cap("Dress level: Hyper3D Rodin models, fitted inside each box (prebaked here)");
await click("Dress level");
await wait(22000);
await cap("Models are fitted inside the boxes, never bigger than the contract");
await wait(3500);
await cap("Heatmap off · Show colliders: collision is still the original greybox");
await click("Heatmap");
await wait(1500);
await click("Colliders");
await wait(5000);
await click("Colliders");
await wait(1000);
await cap("5 · Play: walk the dressed level in first person (WASD + mouse)");
await click(/Walk \(FPS\)/);
await wait(3000);
await p.mouse.click(720, 450); // locks the pointer in a real, visible browser
for (const [key, ms] of [["w", 2500], ["d", 700], ["w", 2500], ["a", 900], ["w", 1500]]) {
  await p.keyboard.down(key);
  await wait(ms);
  await p.keyboard.up(key);
}
await p.mouse.move(720, 450);
await p.mouse.move(900, 430, { steps: 25 }); // look around
await wait(2500);
await p.keyboard.press("Escape");
await wait(1500);
await cap("Export a zip (level.json + GLBs) for Unity, Unreal or Godot · share as a link");
await click("Export zip").catch(() => {});
await wait(4000);
await click("Copy link").catch(() => {});
await wait(2500);
await cap("PLAYBOUND: AI that cannot break your level design.");
await wait(4000);

await ctx.close(); // flushes the video
await browser.close();
console.log("Saved to recordings/raw/");
