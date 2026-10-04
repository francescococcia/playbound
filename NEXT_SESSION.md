# NEXT SESSION: start here (written 4 Oct 2026, ~06:00)

PLAYBOUND: Tencent × Arcade AI Hackathon (Cambridge), Game Tech track. **Submission: Sun 4 Oct, 14:00 UK. Feature freeze: 11:00.**
Live: https://playbound-eta.vercel.app · Repo: https://github.com/francescococcia/playbound (public, `main`)

## Read first (in this order)
1. This file.
2. `PLAN.md`: task board, rounds 1–4, feedback per milestone, and **"Known facts"** at the bottom.
3. `HANDOFF.md`: append-only log of what each builder did (newest at the bottom).
4. `DESIGN_BRIEF.md`: UI direction (blueprint workshop, colours, motion, Co-designer).
5. `README.md`: what the product is and how to run it.

## Who does what
- **Claude Code**: `src/core/**`, `server/**`, `api/**`, `scripts/**`, config, deploy, `src/ui/panels/CoDesignerPanel.tsx`, `src/ui/scene/BotReplay.tsx`, `src/ui/panels/ReplayCard.tsx`, `src/ui/round4.css`, `src/ui/motion.ts`.
- **Cursor**: the other `src/ui/**` files + `src/index.css`. Right now Cursor is on **B (Play mode)**: prompt in `CURSOR_PROMPT_ROUND4B.md`.
- **Rules:** same folder, same branch `main`, no branches. Each commits only its own paths (never `git add -A`). Only Claude Code pushes and deploys. **Deploy only when the working tree has no half-done Cursor UI** (`npx vercel deploy --prod --yes` uploads the working tree).

## State (all pushed + deployed)
Done: editing + undo/redo, share/save/play links (core), Prove v2 (line of sight + heatmap), playtest bot replay, Co-designer agent (Gemini: sketch→level, why, fix verified by Prove, edits with options, style from image) with step guide, Dress with 10 prebaked models made with the **Hyper3D API + bbox_condition**, live Regenerate / From photo (local), export zip, motion, phone layout (Cursor U21). 41 tests pass.

## Remaining (in order)
1. **Bot model** (Claude Code, approved by Francesco): generate a player-scale runner with Rodin (API route, `size: [0.7, 1.8, 0.5]`, prompt from the level style, e.g. "small medieval town guard, full body, running pose"), save it as `/assets/gen/bot-runner.glb` (keep it out of `--prune`: skip keys starting with `bot-`), and use it in `BotReplay.tsx` via `useGLTF` + `fitToVolume`, keeping the capsule as the Suspense fallback. The coral/green ring + "Spotted!" label stay as the signal.
2. **C: Autopilot** (Claude Code): "Build me a level" → the Co-designer proposes layout → Prove → fix → style, **one approved step at a time** (reuse `server/ai/agent.ts` intents + `aiAgent`; add a small step tracker in the thread).
3. **B: Play mode** (Cursor, in progress). Review it when Cursor stops: open a play link, play to the objective, check the timer/win screen, then deploy.
4. **Francesco's visual check** of the whole flow on the live site; fix notes (Cursor for its files).
5. **11:00 freeze** → **video** (script in README; run `hyper3d auth login` right before if using the CLI; the API key path doesn't need it) → **submit** (live URL + video + repo).
6. Optional for Francesco: in Hyper3D Text-to-Image, create a clean top-down **sketch** and a **style painting** as demo inputs.

## Run
```
cd playbound
npm run dev          # http://localhost:5173 (AI + Rodin routes need .env)
npm test             # 41 tests
npm run build
```
Keys live in `playbound/.env` (git-ignored): `GEMINI_API_KEY`, `HYPER3D_API_KEY` (Business plan, ~520 credits), `CURSOR_API_KEY` (unused). Vercel has `GEMINI_API_KEY` (server-only). **Never paste keys in chat; never put them in `.env.example`.**

## Gotchas learned the hard way
- **Vercel AI function = ESM:** imports along `api/ai/[action].ts` → `server/ai/*` → `src/core/{geometry,prove/*}` need explicit `.js` extensions.
- **Vite re-optimizing a new dependency mid-session** can load two copies of React ("Invalid hook call"): stop the dev server, delete `node_modules/.vite`, restart.
- **Browser pane screenshots** only work while the Claude window is visible; when hidden, animations (useFrame) pause too. Test logic with DOM checks + unit tests.
- **Bash heredocs with apostrophes** (`can't`) break this shell: write scripts/CSS to a file with the Write tool, then run them.
- **Cursor SDK on Windows:** the default SQLite store path exceeds MAX_PATH; use `JsonlLocalAgentStore` (not used in the app).
- **Hyper3D CLI login expires** after a few hours; the API key route doesn't.
- `npx tsx scripts/prebake.ts http://localhost:5199` regenerates; `--prune` removes models no preset uses. Asset keys include `PIPELINE_VERSION` in `src/core/dress/prompt.ts`.
- Test dev server on port 5199 can outlive its background task: free the port with PowerShell `Stop-Process` on the port's owner before restarting.

## Suggested first message in the new chat
> Read `playbound/NEXT_SESSION.md`, `PLAN.md` (Round 4 + Known facts) and the end of `HANDOFF.md`. Then continue with the remaining tasks: first the bot model, then C (autopilot). Check whether Cursor finished B (Play mode) and review it.
