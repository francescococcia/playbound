# Cursor: take over from Claude Code (Claude usage limit, 4 Oct ~08:10)

Claude Code is out of usage. You now own the whole repo, including `src/core/**`, `server/**`, `api/**`, git push. Francesco runs the deploy.

## State
Everything up to Round 5 F1–F6 is committed and pushed (see the end of `HANDOFF.md`, `PLAN.md` Round 5). 58 tests pass. Live: https://playbound-eta.vercel.app (not yet deployed: Round 5 fixes + your U22).

## Do, in order
1. Finish **U22** in `CURSOR_PROMPT_ROUND5.md` (items 1–9; 10 optional).
2. Check: `npm test` (all pass), `npx tsc --noEmit -p .`, `npm run build`.
3. Commit your files (never `git add -A`), then **also commit the 17 new GLBs + `public/assets/gen/manifest.json`** (Francesco's dressed Cambridge level; they make its play link show real models on the live site):
   `git add public/assets/gen` → commit → `git push origin main`.
4. Tell Francesco to deploy: `npx vercel deploy --prod --yes` (from `playbound/`, with a clean working tree).
5. Append a HANDOFF entry.

## Rules that still matter
- Vercel AI function is ESM: imports along `api/ai/[action].ts` → `server/ai/*` → `src/core/*` need explicit `.js` extensions (e.g. `../../src/core/layout.js`).
- If Vite shows "Invalid hook call" after adding a dependency: stop the dev server, delete `node_modules/.vite`, restart.
- Never put API keys in code, chat or `.env.example`. Keys are in `playbound/.env` (git-ignored).
- 11:00 feature freeze: after that, only bug fixes.

## Demo (for the video, filmed locally with `npm run dev`)
Drop `demo/cambridge-market-square-osm.png` into the Co-designer → Accept (Cambridge Market Square, 80 m) → Prove passes → "It's festival day: clear all the market stall rows" → Accept the clear-all option → fails, bot "Spotted!" → "Fix it" → Accept → passes → Lock → style → Dress → Copy play link. Show "© OpenStreetMap contributors" when the map is on screen.
