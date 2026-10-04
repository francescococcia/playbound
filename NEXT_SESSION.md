# NEXT SESSION: start here (updated 4 Oct 2026, ~12:45)

PLAYBOUND: Tencent × Arcade AI Hackathon (Cambridge), Game Tech track. **Submission: Sun 4 Oct, 14:00 UK.** Feature freeze was postponed by Francesco; now it's polish + demo video.
Live: https://playbound-eta.vercel.app · Repo: https://github.com/francescococcia/playbound (`main`)

## Read first
0. `DEMO_SCRIPT.md`: shot-by-shot video script + submission form text.
1. This file. 2. The end of `HANDOFF.md`. 3. `PLAN.md` Round 5. 4. `demo/CREDITS.md` (licences for every demo image).

## What exists now (all pushed)
- **Real place → proven level:** drop a top-down map (or use the Autopilot "Build me a level" box with its image button). Your text is followed as directions ("start at the south end of JJ Thomson Avenue, goal is the West Hub entrance"). The map becomes the **floor** at real scale; the AI writes the real place's **look**. Map sizes 40 / 60 / 80 / **120 m**; boxes never overlap or leave the map.
- **Hosted demo maps** (`public/demo/`, OSM only, matched by SHA-256, real width known): `demo/westhub-osm.png` (121 m, same framing as the satellite shot) and `demo/cambridge-market-square-osm.png`. Play links carry their floor.
- **Local-only demo images** (Google, never host them): `demo/westhub-satellite-120m.png` (best), `westhub-satellite-clean.png`.
- **Prove → bot replay → Fix → Lock → Dress** (Hyper3D API + bbox; buildings get a "one single building" hint, 2K textures). **From photo takes 1–5 photos** (multi-view). Backup models: `demo-guildhall`, `demo-westhub-2views`.
- **After Dress:** "make X glassier" → re-dress only that box; new overall look → re-dress all; layout requests on a locked level → **Unlock** card.
- **Walk / Play = stealth playtest:** Hidden / In cover / Seen pill, red edges, win card says time seen.
- 62 tests pass.

## In progress when this was written
- A **separate design session** (UI polish with the impeccable / ui-ux-pro-max skills) is editing `src/index.css`, `src/ui/**`. Rules it follows: styling only, commits its own files, no push/deploy. **Don't deploy while it has uncommitted changes.**

## Remaining
1. Design session finishes → review its commits (tests + build + run the flow) → push → Francesco deploys (`npx vercel deploy --prod --yes` from `playbound/`, clean tree).
2. Francesco tests locally (needs `npm run dev` + `.env` keys): the 120 m satellite + photos + Dress flow for the video.
3. Record the video (follow `DEMO_SCRIPT.md`) (show credits: OSM, Google imagery, Geograph photos) → submit by 14:00 (live URL + video + repo).

## What only works locally
Dress / From photo / re-dress (Hyper3D route is dev-only), Google satellite images. Keys are in `playbound/.env` (git-ignored): never paste them anywhere.

## Gotchas
- Restart the dev server after any `server/**` change.
- Vercel AI function is ESM: relative imports in the `server/ai` → `src/core` chain need `.js`.
- Browser-pane screenshots/animations pause when the Claude window is hidden.
- In this Windows Git Bash, heredocs can turn `\b` into a control character: write scripts to files instead.
