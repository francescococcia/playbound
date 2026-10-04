// Host the demo maps so play links can show them as the floor (an upload is too big for a URL).
// Copies each map from demo/ to public/demo/ and writes public/demo/maps.json with its SHA-256:
// when a designer drops the same file, the level points at the hosted copy.
// Run after replacing a demo map:  node scripts/demo-maps.mjs
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// OSM only: Google imagery may be shown in a video with credit, but not hosted in the app.
const MAPS = [
  // widthMeters: the real width the image covers (told to the AI, so the level keeps real scale).
  { file: "westhub-osm.png", credit: "© OpenStreetMap contributors", widthMeters: 121 },
  { file: "cambridge-market-square-osm.png", credit: "© OpenStreetMap contributors", widthMeters: 110 },
];

mkdirSync("public/demo", { recursive: true });
const out = [];
for (const m of MAPS) {
  const src = `demo/${m.file}`;
  if (!existsSync(src)) continue;
  const bytes = readFileSync(src);
  copyFileSync(src, `public/demo/${m.file}`);
  out.push({ url: `/demo/${m.file}`, sha256: createHash("sha256").update(bytes).digest("hex"), credit: m.credit, widthMeters: m.widthMeters });
  console.log(`hosted ${m.file}`);
}
writeFileSync("public/demo/maps.json", JSON.stringify(out, null, 2));
