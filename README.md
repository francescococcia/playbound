# PLAYBOUND

**Prove the greybox. Then dress it.**
AI that cannot break your level design.

**Live:** https://playbound-eta.vercel.app · Built for the Tencent × Arcade AI Hackathon (Cambridge, Oct 2026), Game Tech track.

Level designers block out levels with grey boxes to test gameplay, then wait weeks for art. Text-to-3D tools make one object at a time with no idea of the level. World generators invent a layout the designer never approved.

PLAYBOUND keeps the designer's layout as a **contract**, and puts AI at every step, always as a *proposal* the designer accepts or rejects:

1. **Contract.** Draw a level on paper, or start blank. The **AI co-designer** (Gemini) turns a sketch, map or screenshot into greybox boxes, each with a role (spawn, objective, cover, block, landmark, prop) and an exact size in meters. Edit freely: add, resize, rotate, delete, or ask in words ("add a fountain near the well").
2. **Prove.** A bot finds the walking route from spawn to objective, and a **line-of-sight check** from the objective shows what defenders can see (the heatmap). A route that's mostly in the open fails as a "death corridor". **Suggest fix** asks the AI for cover; every suggestion is re-checked by Prove before you see it. Only a passing layout can be **locked**.
3. **Dress.** A style image becomes style notes (AI). For each locked box, PLAYBOUND writes a prompt (label, role, real-world size, style) and **Hyper3D Rodin** generates a 3D model, or builds it from a photo of the real object (image-to-3D). The model is fitted *inside* its box. **Collision stays the box**, so the art can't block a route or open a gap.
4. **Play, share, export.** Walk the dressed level in first person, regenerate any object, share the level as a link, and export a zip (`level.json` + GLB models) for Unity, Unreal or Godot.

## Try it (3 minutes)

1. Open the live link. Preset **Market Square (fail)** → **Prove**: a red route, the heatmap, and "Death corridor: 0% of the route is protected".
2. Click **Suggest fix** on the banner → a ghost cover box appears with "Playable" → **Accept** → **Prove**: green. (Or drag the blue cart next to the route yourself.)
3. **Lock** → pick a **Style** image (the AI reads its style) → **Dress**: the boxes become Rodin models (prebaked, instant).
4. Tick **Show colliders** to see the boxes around the models, then switch to **FPS** and walk (WASD, mouse, Esc).
5. **Share** copies a link to your level. **Export** downloads the level zip.
6. Try **Sketch → level** with a photo of a top-down drawing: the AI proposes the whole greybox.

## Honest limits

- **Prove is a heuristic, not a combat simulation:** a route exists, and ≥25% of it is *protected* (out of the objective's line of sight, or within 2.5 m of cover). Line of sight runs from one defender position (the objective) at eye height 1.7 m to a crouching player at 1.0 m. The constants are in `src/core/prove/constants.ts`.
- **The AI only proposes.** Answers are cleaned on the server (kept inside the play area, unique ids, one spawn and one objective) and previewed with Prove, but a sketch can still be misread, so check the ghosts before you Accept. On the public site the AI runs on Gemini's free tier with a usage cap.
- **Live 3D generation runs locally.** The Rodin HTTP API needs the Hyper3D Business plan, so generation goes through the Hyper3D CLI (OAuth login, which expires after a few hours) on the designer's machine. The public site uses prebaked models, and Regenerate / From photo show "needs a Hyper3D connection".
- **Image-to-3D quality depends on the photo:** one clear object on a plain background works; small or cluttered images give poor models.
- **Share links** carry the layout, style notes and prebaked models, not the style image (too big for a URL). Saves live in this browser only.
- **Rodin ignores the requested size.** Models come back at arbitrary scale. `fitToVolume` scales each one uniformly (plus at most 25% sideways stretch) to sit inside its box. Odd-shaped models leave some empty space in the box (fill 37–100% on the hero level).
- **Style consistency** comes from shared style text in every prompt, not from training. It's good across this level but not guaranteed.
- **Environment:** an HDRI sky and a textured ground. HY-World is not integrated.

## Run locally

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Prove, line of sight, fit, dress, store, share and export tests (no network, no credits)
npm run build      # typecheck + production build
```

### AI co-designer (Gemini)

Create a free key at https://aistudio.google.com and put it in `.env` (copy `.env.example`):

```
GEMINI_API_KEY=...
```

The dev server exposes `/api/ai/*` (sketch, style, command, fix). On Vercel the same handler runs as a function (`api/ai/[action].ts`); set `GEMINI_API_KEY` in the project's environment variables. The key never reaches the browser.

### Live generation (Hyper3D Rodin)

```bash
npm install --global @hyper3d/cli
hyper3d auth login         # browser login; uses your account credits (~0.5 per model)
npm run dev                # the dev server now exposes /api/rodin
```

With the dev server running, Dress generates any box that isn't prebaked (about 2 minutes each, 3 at a time), and Regenerate makes a new variant. Each model is downloaded, shrunk (~28 MB → ~1 MB with meshopt and WebP) and cached in `public/assets/gen/` by a hash of `(prompt, size, variant)`. The same request never spends credits twice.

### Prebake the demo level

```bash
npm run dev
npx tsx scripts/prebake.ts http://localhost:5173          # generate every dressable box of the presets
npx tsx scripts/prebake.ts --prune                        # remove models no preset uses
```

Then open `/dev-viewer.html` to see every model fitted inside its wireframe box.

## How it's built

| Part | Where |
|---|---|
| Level contract (types, coordinates) | `src/core/types.ts` |
| Market Square presets (fail / pass) | `src/presets/marketSquare.ts` |
| Prove: A* on a 0.5 m grid, line of sight + exposure heatmap, cover check | `src/core/prove/` |
| Editing, AI proposals (accept / reject) | `src/core/store.ts` |
| AI co-designer: Gemini client, validation, suggest-fix agent loop | `server/ai/`, `src/core/ai/`, `api/ai/` |
| Share links + local saves | `src/core/share.ts` |
| Shared collision (player and bot use the same boxes) | `src/core/geometry.ts` |
| Dress: prompt builder, queue, prebaked → live → error | `src/core/dress/` |
| Fit any model inside its box | `src/core/dress/fit.ts` |
| Hyper3D CLI route, incl. image-to-3D (dev only) | `server/rodinDevPlugin.ts` |
| Export zip | `src/core/export/exportLevel.ts` |
| UI: three.js / react-three-fiber scene and panels | `src/ui/` |

Stack: Vite, React 19, TypeScript, three.js, @react-three/fiber, drei, zustand, vitest, Gemini (REST), Hyper3D Rodin (CLI). Deployed on Vercel.

This was built by one person with two AI coding agents working in parallel: Claude Code on `src/core`, the server and deploy, and Cursor on `src/ui`. They coordinated through [`PLAN.md`](PLAN.md) (task board and human feedback per milestone) and [`HANDOFF.md`](HANDOFF.md) (append-only log).

## Demo script (≈2 min)

| Time | Beat |
|---|---|
| 0:00 | A paper sketch of a market square → **Sketch → level** → ghost greybox → Accept |
| 0:20 | **Prove** → fails: death corridor, red route, heatmap of what the defenders see |
| 0:35 | **Suggest fix** → AI proposes a cart, Prove re-checks it → Accept → pass → Lock |
| 0:55 | **Style** image → AI style notes → **Dress** → Rodin models fill the boxes (each ~2 min live; prebaked here) |
| 1:25 | FPS walk; **Show colliders**: collision still matches the greybox; regenerate one prop live |
| 1:45 | **Share** link + **Export** zip. "AI that cannot break your level design." |
