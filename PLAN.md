# PLAYBOUND — build plan & task board

**Product:** Designers lock greybox boxes as gameplay contracts → a bot proves the level is playable → only then AI (Hyper3D Rodin) dresses each box with a mesh of the same size. Collision always stays the original boxes.
**Deadline:** Sun 4 Oct 2026, 14:00. Full spec: `../PLAYBOUND_BUILD_PROMPT.md`.

## How we work (read this first)

Two builders and one human:

| Who | Owns (only edits these) |
|---|---|
| **Claude Code** | `src/core/**`, `src/presets/**`, `api/**`, root config (`package.json`, `vite.config.ts`, `tsconfig.json`, `README.md`) |
| **Cursor** | `src/ui/**`, `src/index.css` |
| **Francesco (human)** | Tests each milestone, writes feedback below, decides what's next |
| Shared, edit with care | `src/App.tsx` (Cursor may change the layout), `PLAN.md` (status only), `HANDOFF.md` (append only) |

Rules:
1. `src/core/types.ts` is the **contract**. Don't change it. Need a change? Ask in `HANDOFF.md`.
2. The UI never edits `level` directly. Use the actions in `src/core/store.ts` (`usePlaybound`).
3. Need a new package? Write it in `HANDOFF.md`. Claude Code installs it (avoids lockfile clashes).
4. Take only tasks with your name. Status flow: `todo → doing → done`.
5. After each task, append to `HANDOFF.md`: what, files, how to test, notes for the other side.
6. **Stop at the end of each milestone** until Francesco writes feedback.

Run: `npm run dev` (app) · `npm test` (Prove tests) · `npm run build` (typecheck + build)

---

## M1 — See the level
*Done when Francesco can open the app, see the grey market square with labels, and walk around it in first person.*

| ID | Owner | Task | Status |
|---|---|---|---|
| C1 | Claude Code | Scaffold (Vite + React + TS + three/R3F/drei + zustand), `types.ts`, Market Square fail/pass presets, `store.ts`, `geometry.ts` | done |
| C2 | Claude Code | Prove: A* + cover check + tests (ahead of schedule for M2) | done |
| U1 | Cursor | `Viewport`: R3F canvas, 40×40 m ground with low edge wall, one box per volume coloured by `ROLE_COLORS`, floating labels, orbit camera. **Note:** `position` = bottom-centre → mesh y = `size[1]/2`. Spawn/objective drawn as flat markers (not solid). | todo |
| U2 | Cursor | Click a box → select (highlight). `SidePanel`: volume list synced to selection + inspector (label, role, size). | todo |
| U3 | Cursor | FPS mode: orbit/FPS toggle (`viewMode`), pointer lock, WASD ~4 m/s, eye height 1.6 m, start at the spawn. Collision **must** use `resolveCollision(x, z, 0.35, level.volumes, level.bounds)` from `src/core/geometry.ts`. | todo |

**Francesco feedback M1:** _(write here)_

---

## M2 — Prove works
*Done when: Prove → red fail with reason; drag the cart next to the route → Prove → green pass → Lock.*

| ID | Owner | Task | Status |
|---|---|---|---|
| U4 | Cursor | Prove overlay: draw `prove.path`; segments green where `covered[i]`, red where exposed (the "heatmap"); banner with `prove.message`; small honest-limit line: "Prove = path + cover heuristic, not a combat sim." | todo |
| U5 | Cursor | Drag a box on the ground (XZ only) when unlocked → `updateVolume(id, { position })`. Disabled when locked. | todo |
| U6 | Cursor | TopBar: Style ref (file → data URL → `setStyleRef`) with thumbnail · Prove · Lock/Unlock · Dress (disabled, tooltip = `canDress(level).why`) · Export · Share (placeholders until M4). | todo |
| C3 | Claude Code | Check the Rodin API (bbox/size control, cost, timing), then write the `api/rodin` server route (key server-only) + disk/blob cache. | todo |

**Francesco feedback M2:** _(write here)_

---

## M3 — Dress works
*Done when: Dress → each box becomes a real model of the same size; colliders still match the boxes.*

| ID | Owner | Task | Status |
|---|---|---|---|
| C4 | Claude Code | `src/core/dress/`: prompt builder (spec template), queue (concurrency 3), `dressLevel()` + `regenerate(id)` that call the API and update status via `setVolumeAsset`. | todo |
| C5 | Claude Code | `fitToVolume(object3D, volume)`: scale/centre any GLB to the box size. This is the "AI can't break the layout" guarantee. | todo |
| U7 | Cursor | Render a GLB when `assetUrl` is set (`useGLTF` + `fitToVolume`), hide the grey box, "Show colliders" wireframe toggle, per-volume progress list. | todo |
| U8 | Cursor | Environment: HDRI sky (drei `Environment`) + textured ground (HY-World is out of scope). | todo |

**Francesco feedback M3:** _(write here)_

---

## M4 — Regenerate + export

| ID | Owner | Task | Status |
|---|---|---|---|
| C6 | Claude Code | Export: zip with `level.json` + GLBs (jszip). | todo |
| U9 | Cursor | Inspector: prompt text, **Regenerate** button → `regenerate(id)`, spinner. Export button wired. | todo |

**Francesco feedback M4:** _(write here)_

---

## M5 — Live + demo

| ID | Owner | Task | Status |
|---|---|---|---|
| C7 | Claude Code | Deploy to Vercel (public URL), env var, README (env, prebake, limits, demo script). | todo |
| C8 | Claude Code | Prebake hero level: generate and cache ≥ 6 Rodin assets; load them from the preset. | todo |
| U10 | Cursor | Polish pass: readable labels, loading states, phone-width check. | todo |
| H1 | Francesco | Record the 2-minute demo video (script in the spec). | todo |

---

## Known facts (keep updated)
- Prove constants: `src/core/prove/constants.ts` (cell 0.5 m, cover radius 2.5 m, need 25% covered, agent radius 0.4 m).
- Fail preset: 23 m route, 0% covered → `NO_COVER`. Pass preset (cart at x 1.6, z −2): 28% → pass.
- To make the drag demo pass, place the cart within about 1–2 m of the route between the corridor and the well.
