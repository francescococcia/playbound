# PLAYBOUND

**Prove the greybox. Then dress it.**
AI that cannot break your level design.

**Live:** https://playbound-eta.vercel.app · Built for the Tencent × Arcade AI Hackathon (Cambridge, Oct 2026), Game Tech track.

Level designers block out levels with grey boxes to test gameplay, then wait weeks for art. Text-to-3D tools make one object at a time with no idea of the level. World generators invent a layout the designer never approved.

PLAYBOUND keeps the designer's layout as a **contract**:

1. **Contract.** Every box has a role (spawn, objective, cover, block, landmark, prop) and an exact size in meters.
2. **Prove.** A bot finds the walking route from spawn to objective and checks how much of it has cover nearby. A fail shows the "death corridor" in red. Only a passing layout can be **locked**.
3. **Dress.** For each locked box, PLAYBOUND writes a prompt (label, role, real-world size, style) and Hyper3D Rodin generates a 3D model. The model is fitted *inside* its box. **Collision stays the box**, so the art can't block a route or open a gap.
4. **Play and export.** Walk the dressed level in first person, regenerate any object, and export a zip (`level.json` + GLB models) for Unity, Unreal or Godot.

## Try it (2 minutes)

1. Open the live link. Preset **Market Square (fail)** → **Prove**: a red route, "Death corridor: 0% cover".
2. Drag the blue **market cart** next to the red route → **Prove**: green.
3. **Lock** → pick a **Style** image → **Dress**: the boxes become Rodin models (prebaked, instant).
4. Tick **Show colliders** to see the boxes around the models, then switch to **FPS** and walk (WASD, mouse, Esc).
5. **Export** downloads the level zip.

## Honest limits

- **Prove is a heuristic** (path exists + ≥25% of it within 2.5 m of cover), not a combat simulation. The constants are in `src/core/prove/constants.ts`.
- **Live generation runs locally.** The Rodin HTTP API needs the Hyper3D Business plan, so generation goes through the Hyper3D CLI (OAuth login) on the designer's machine. The public site uses prebaked models, and Regenerate shows "needs a Hyper3D connection".
- **Rodin ignores the requested size.** Models come back at arbitrary scale. `fitToVolume` scales each one uniformly (plus at most 25% sideways stretch) to sit inside its box. Odd-shaped models leave some empty space in the box (fill 37–100% on the hero level).
- **Style consistency** comes from shared style text in every prompt, not from training. It's good across this level but not guaranteed.
- **Environment:** an HDRI sky and a textured ground. HY-World is not integrated.

## Run locally

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Prove, fit, dress and export tests (no network, no credits)
npm run build      # typecheck + production build
```

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
| Prove: A* on a 0.5 m grid + cover check | `src/core/prove/` |
| Shared collision (player and bot use the same boxes) | `src/core/geometry.ts` |
| Dress: prompt builder, queue, prebaked → live → error | `src/core/dress/` |
| Fit any model inside its box | `src/core/dress/fit.ts` |
| Hyper3D CLI route (dev only) | `server/rodinDevPlugin.ts` |
| Export zip | `src/core/export/exportLevel.ts` |
| UI: three.js / react-three-fiber scene and panels | `src/ui/` |

Stack: Vite, React 19, TypeScript, three.js, @react-three/fiber, drei, zustand, vitest. Deployed on Vercel.

This was built by one person with two AI coding agents working in parallel: Claude Code on `src/core`, the server and deploy, and Cursor on `src/ui`. They coordinated through [`PLAN.md`](PLAN.md) (task board and human feedback per milestone) and [`HANDOFF.md`](HANDOFF.md) (append-only log).

## Demo script (≈2 min)

| Time | Beat |
|---|---|
| 0:00 | Greybox market square, roles visible, style reference pinned |
| 0:15 | Prove → fails: death corridor, red route |
| 0:35 | Drag the cart next to the route → Prove → pass → Lock |
| 0:50 | Dress → Rodin models fill the boxes (each ~2 min live; prebaked here) |
| 1:20 | FPS walk; Show colliders: collision still matches the greybox; regenerate one prop live |
| 1:40 | Export zip + share link. "AI that cannot break your level design." |
