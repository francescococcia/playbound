# HANDOFF log (append only, newest at the bottom)

Format:
```
## <date time> — <Claude Code | Cursor> — <task IDs>
Built: …
Files: …
Test: …
For the other side: …
```

---

## 2026-10-03 — Claude Code — C1, C2

Built:
- Project scaffold: Vite 8 + React 19 + TypeScript + three + @react-three/fiber 9 + @react-three/drei 10 + zustand 5 + vitest.
- `src/core/types.ts`: the shared contract (Level, Volume, ProveResult, SOLID_ROLES, DRESS_ROLES, ROLE_COLORS). Coordinate notes are at the top of the file. **Position is the bottom-centre of the box.**
- `src/presets/marketSquare.ts`: "Market Square", fail + pass versions (10 volumes each). The only difference is the cart's position.
- `src/core/store.ts`: `usePlaybound()` with actions `loadPreset, select, setViewMode, updateVolume, runProve, lock, unlock, setStyleRef, setVolumeAsset` and the helper `canDress(level)`. Lock only works after a pass. `updateVolume` is ignored while locked and resets Prove to idle.
- `src/core/geometry.ts`: `distanceToFootprint`, `isSolid`, `resolveCollision`. These handle rotated boxes.
- `src/core/prove/`: A* on a 0.5 m grid + a cover check. 4 tests pass.
- Placeholder UI in `src/ui/` (TopBar with Prove/Lock buttons, SidePanel with the preset picker, empty Viewport). **Cursor: replace these freely.**

Files: everything under `playbound/`.

Test: `npm test` (4 pass) · `npm run build` (passes) · `npm run dev`, then click Prove (the message shows the fail reason; switch preset → pass → Lock enables).

For Cursor:
- Start with U1 → U2 → U3 in PLAN.md.
- For FPS collision, call `resolveCollision` each frame. Don't write your own, so the player and the Prove bot share the same walls.
- Spawn and objective are not solid. Draw them as flat discs/markers.
- `level.bounds` = 20 → the play area is x, z ∈ [−20, 20]. Draw a low wall on the edge.

## 2026-10-03 — Claude Code — plan change (Hyper3D access)

The Rodin API needs the Business plan, which we don't have. Generation goes through the Hyper3D CLI/MCP (OAuth, account credits) instead. Updated in PLAN.md: C3, C4, C7, C8, and "Known facts".
For Cursor: nothing changes in the UI contract. Dress/Regenerate will call `regenerate(id)` / `dressLevel()` from `src/core/dress/` (coming in C4). On the public deploy, live regenerate shows an error badge and prebaked models are used.

---

## 2026-10-03 ~14:45 — Cursor — U1, U2, U3

Built:
- **U1 Viewport:** R3F canvas with shadows, 40×40 m ground (`bounds*2`), low edge wall ring, one mesh per volume coloured by `ROLE_COLORS`, floating `Html` labels, orbit camera. Boxes use bottom-centre → `y = size[1]/2`. Spawn/objective are flat discs + rings (not solid boxes).
- **U2 Selection:** Click a volume (or SidePanel row) → `select(id)` with emissive + wireframe highlight. SidePanel has preset picker, volume list synced to selection, inspector (label, role, size, position). Click empty ground deselects.
- **U3 FPS:** TopBar Orbit/FPS toggle via `setViewMode`. FPS: PointerLockControls, WASD @ 4 m/s, eye 1.6 m, starts at spawn, collision via `resolveCollision(..., 0.35, volumes, bounds)`. Orbit camera resets when leaving FPS.

Files:
- `src/ui/scene/Viewport.tsx`
- `src/ui/scene/Ground.tsx` (new)
- `src/ui/scene/VolumeMesh.tsx` (new)
- `src/ui/scene/FpsController.tsx` (new)
- `src/ui/panels/SidePanel.tsx`
- `src/ui/panels/TopBar.tsx` (Orbit/FPS + Unlock; full TopBar polish is U6)
- `src/index.css`

Test:
1. `npm run dev` → Market Square greyboxes + labels visible; orbit drag works.
2. Click tavern / cart → highlight + SidePanel inspector updates; click list rows too.
3. Switch to **FPS** → click canvas → lock → WASD walk from south gate; bump into tavern/guildhall (should stop); Esc unlock.
4. `npm test` (4 pass) · `npm run build` (pass).

For Claude Code: no contract changes needed. TopBar still has basic Prove/Lock — U6 will add Style ref / Dress / Export / Share. Drag-to-move (U5) and Prove overlay (U4) are next milestone.

## 2026-10-03 — Claude Code — C3, C5

Built:
- `server/rodinDevPlugin.ts` (dev-only Vite middleware, wired in `vite.config.ts`):
  - `GET /api/rodin/health` → `{ live: true }` (404 on the public build means "no live generation").
  - `POST /api/rodin/generate` with body `GenerateRequest` → `JobResponse`. Cached by `key`, so a repeat request returns `ready` instantly with no credits spent.
  - `GET /api/rodin/status?id=` → `JobResponse` (`queued | generating | processing | ready | error`, plus `stage` and `url`).
  - Pipeline: Hyper3D CLI generate → poll → download → gltf-transform optimize (28 MB → 1.2 MB) → `public/assets/gen/<key>.glb` + `manifest.json`.
- `src/core/dress/prompt.ts`: `buildPrompt(volume, styleNotes)`, `assetKey(prompt, size, seed)`.
- `src/core/dress/rodinTypes.ts`: wire types.
- `src/core/dress/fit.ts`: **`fitToVolume(object3D, volume.size)`**. Uniform scale so the model sits INSIDE the box, a 90° turn if that fits better, bottom-centre at the origin. Tested (6 tests pass in total).
- `dev-viewer.html`: preview any generated asset at `/dev-viewer.html?k=testcart01`.
- Test asset: `/assets/gen/testcart01.glb` (a real Rodin covered wagon) for U7.
- Preset: the cart label is now "low open wooden market cart, no canopy" (the canopy made it too tall to be cover).

For Cursor (U7, when you get there):
- GLBs are **meshopt-compressed**. drei's `useGLTF(url)` decodes meshopt by default. With a raw GLTFLoader, call `setMeshoptDecoder(MeshoptDecoder)`.
- **Clone before fitting:** `const obj = useMemo(() => gltf.scene.clone(true), [gltf])`, then `fitToVolume(obj, v.size)`, then render `<group position={v.position} rotation-y={v.rotationY}><primitive object={obj} /></group>`.
- First load takes a few seconds (webp decode). Show the grey box until the GLB is ready (Suspense fallback = the box).
- Keep the invisible collider = the contract box. Never use the mesh for collision.

## 2026-10-03 — Claude Code — C4 (Dress engine)

Built `src/core/dress/dress.ts`:
- `dressLevel()`: dresses every cover/block/landmark/prop that isn't `ready`, 3 at a time. Throws `canDress(level).why` if not allowed.
- `regenerate(id)`: bumps `variant` and generates a new model. The old `assetUrl` stays visible until the new one is ready.
- `isLiveAvailable()`: true only on the local dev server (Hyper3D CLI route present).
- Source order per box: prebaked (`/assets/gen/manifest.json`) → live (`/api/rodin`) → `status: "error"` with the message "Live generation needs a Hyper3D connection (run the app locally)". The grey box always stays.
- 5 tests with a fake server (no credits): gate, prebaked, no-live error, live polling (positions/sizes unchanged), regenerate.

Contract (additive, optional): `Volume.stage` (e.g. "mesh 2/5", "optimizing") and `Volume.variant`. `setVolumeAsset` accepts both.
Presets now have default `styleNotes` (`MARKET_STYLE`). The prompt uses `level.styleNotes`; the style ref image is shown in the UI and gates Dress.

For Cursor (U6/U7/U9):
- Dress button: `onClick={() => dressLevel().catch(e => toast(e.message))}`, disabled when `!canDress(level).ok` (tooltip = `why`).
- Progress list: each dressable volume shows `status` + `stage` (+ `error` in red).
- Inspector: show `prompt`; Regenerate button → `regenerate(id)`. Disable it with the tooltip "needs Hyper3D connection" when `await isLiveAvailable()` is false.
- Style ref: a text field for `styleNotes` next to the image (`setStyleRef(url, notes)`).

---

## 2026-10-03 ~15:30 — Cursor — M1 feedback + U4, U5, U6

Built:
- **M1 fixes:** Mid-grey ground + 1 m / 5 m grid; high orbit camera `[8,48,36]`; labels fixed screen size — always spawn/objective/cover, others on hover/select; Prove message moved out of TopBar into viewport banner (no button jump); objective well has gold beacon + point light.
- **U4:** `ProvePath` draws path segments green/red from `covered[]`; `ProveBanner` with message + honest-limit line.
- **U5:** Drag any volume on XZ when unlocked → `updateVolume`; OrbitControls disabled while dragging; no-op when locked.
- **U6:** Style ref file → data URL thumbnail + style notes field; Prove / Lock|Unlock / Dress (`dressLevel()`, disabled + tooltip from `canDress`); Export/Share placeholders.

Files:
- `src/ui/scene/{Ground,Viewport,VolumeMesh,ProvePath,ProveBanner}.tsx`
- `src/ui/panels/TopBar.tsx`
- `src/index.css`
- `PLAN.md` (statuses)

Test: see chat — M2 checklist for Francesco.

For Claude Code: Dress is wired. U7 should render GLBs via `fitToVolume` when `assetUrl` is set; progress list can read `status`/`stage`/`error`. No contract changes requested.

## 2026-10-03 — Claude Code — C8 (prebake) + fit/preset changes

- **Preset changed** (`src/presets/marketSquare.ts`): each side of the corridor is now two 9 m buildings. New volume ids `bakery` and `chapel` (with `tavern`, `guildhall`), so 12 volumes total. The cart label is now "flat open-top wooden handcart loaded with crates and sacks", and the notice board is 0.8 m deep. Prove results are unchanged (fail 0%, pass 28%).
- **10 prebaked Rodin models** in `public/assets/gen/` (+ `manifest.json`). `dressLevel()` finds them instantly by key, so Dress on the hero preset needs no live generation. `testcart01.glb` was removed; use the real assets for U7.
- `fitToVolume` now also returns `stretch` (≤25% sideways, never taller, still always inside the box).
- `/dev-viewer.html` = gallery of every model inside its wireframe contract box. Useful to compare against your U7 rendering.

---

## 2026-10-03 ~16:20 — Cursor — M2 label fix + U7, U8

Built:
- **M2 fix:** 3D labels use `shortLabel()` (first ≤3 words, max ~22 chars + …). Full `volume.label` stays in the inspector.
- **U7:** `DressedModel` loads meshopt GLB via `useGLTF`, clones, `fitToVolume(obj, size)`, parent at bottom-centre + `rotationY` (same as `/dev-viewer.html`). Grey box as Suspense fallback; hidden once loaded. Invisible pick box for drag/select. **Show colliders** toggle (SidePanel) draws blue wireframe contract boxes; selection also shows wireframe. Dress progress list (`status` / `stage` / `error`) appears after Dress starts.
- **U8:** drei `Environment preset="city"` + procedural cobble ground texture; softer sky/fog; grid kept subtle on top.

Files:
- `src/ui/scene/{DressedModel,VolumeMesh,Viewport,Ground}.tsx`
- `src/ui/panels/SidePanel.tsx`
- `src/ui/{label,uiPrefs}.ts`
- `src/index.css`

Test: Fail/pass → Lock → Style → Dress → grey boxes become Rodin models inside their footprints; toggle Show colliders and compare with `/dev-viewer.html`. FPS collision still uses contract boxes.

For Claude Code: no contract changes. U9 can add Regenerate + prompt in inspector; Export still placeholder.

## 2026-10-03 — Claude Code — fitToVolume fix (M3 review)

- Bug: after Dress, every model sat in the middle of the square. `fitToVolume` measured bounds in world space, so fitting after mounting (as `DressedModel` does in `useLayoutEffect`) cancelled the parent's position. It now measures in the parent's space and works before or after mounting. New regression test (13 tests pass). **No change needed in `DressedModel`.**
- M3 feedback for Cursor is in PLAN.md (FPS clutter). Next for Cursor: M4/U9.

---

## 2026-10-03 ~16:55 — Cursor — M3 FPS declutter + U9

Built:
- **M3 FPS clutter:** In FPS, Prove path is hidden; Prove banner fades out over ~3 s then unmounts; 3D labels show **objective only** (spawn/cover/hover labels stay in Orbit).
- **U9:** Inspector shows `prompt` text; **Regenerate** → `regenerate(id)` with spinner while queued/generating. Disabled with tooltip **"needs Hyper3D connection"** when `isLiveAvailable()` is false. Export still a disabled placeholder until C6 lands.

Files:
- `src/ui/scene/{ProveBanner,Viewport,VolumeMesh}.tsx`
- `src/ui/panels/{SidePanel,TopBar}.tsx`
- `src/index.css`

Test: Dress → FPS = clean corridor (objective label + beacon only). Orbit inspector → pick cart → see prompt → Regenerate (live only on local Hyper3D; otherwise disabled).

For Claude Code: when C6 export lands, note the function name in HANDOFF — Cursor will wire the Export button.

## 2026-10-03 — Claude Code — C6 (Export)

Built `src/core/export/exportLevel.ts`:
- `downloadLevelZip(level)`: builds and downloads `<level-id>.zip`. **Wire the Export button to this:** `onClick={() => downloadLevelZip(level).catch(e => toast(e.message))}`. It works at any time (undressed volumes are exported as boxes only). Show a spinner, since it takes ~1.5 s for the dressed hero level.
- Zip = `level.json` (format `playbound-level@1`: transforms, roles, prompts, Prove summary, and per-asset `transform` that places the raw GLB inside its box) + `assets/<id>.glb` + `README.txt` (Unity/Unreal/Godot import notes; collision = the box).
- Also `buildExportZip(level)` → `Blob` if you need it. A test with a fake fetch covers it. Checked for real in the browser: 10 models, 7 MB, 1.4 s.

Also for Cursor (from the drag test): start a drag only after the pointer moves > ~5 px, so a click only selects. The hay bales got moved by an accidental drag.

---

## 2026-10-03 ~17:20 — Cursor — Export wire + drag threshold + U10

Built:
- **Export:** TopBar → `downloadLevelZip(level)` with spinner (“Exporting…”) + toast on success/error.
- **Drag threshold:** pointer must move > 5 px before a drag starts; plain click only selects (no accidental hay/cart moves).
- **U10 polish:** higher-contrast role-tinted labels; loading chips on volumes (queued/generating + Suspense “Loading model…”); Dress/Export/Regenerate spinners; phone layout ≤760px with **Panel** drawer + backdrop.

Files:
- `src/ui/panels/TopBar.tsx`
- `src/ui/scene/VolumeMesh.tsx`
- `src/ui/uiPrefs.ts`
- `src/App.tsx`
- `src/index.css`

Test: Export downloads `<level-id>.zip`; click vs drag on hay; narrow the window / phone width → Panel toggle; Dress shows loading chips.

For Claude Code / Francesco: UI Cursor tasks complete through U10. Ready for demo video (H1) + prod deploy when you want.

## 2026-10-03 — Claude Code — Round 2 kickoff (R1)

- **Round 2 plan** is in PLAN.md (section "ROUND 2"). The new Cursor prompt is `CURSOR_PROMPT_ROUND2.md`. **Git rules changed:** Cursor commits its own paths only (no push, no deploy, no branches).
- **R1 done** (`src/core/store.ts`, tests in `store.test.ts`, 22 tests pass):
  - `addVolume(role, position?, patch?) → id` (default size per role in `DEFAULT_SIZE`; a new spawn/objective replaces the old one; selects the new box), `removeVolume(id)`, `duplicateVolume(id) → id`, `newLevel(name?)`, `setLevel(level)`. All ignored while locked, and all reset Prove to idle.
  - **`Proposal`** (types.ts): `{ id, source: sketch|text|fix|style, why, add?, update?, remove?, replaceAll?, styleNotes?, previewProve? }`. Store: `proposals`, `addProposal`, `acceptProposal`, `rejectProposal`, `clearProposals`. While locked only style proposals apply.
- Coming next from Claude Code: R3 `src/core/share.ts` (share link + saves), then R2/R4 (AI server with Gemini + client `src/core/ai/client.ts`).

---

## 2026-10-03 ~20:15 — Cursor — U11, U15 (R2-M1)

Built:
- **U11 Edit tools:** SidePanel Add menu (roles → `addVolume` at view-centre ground pick), Delete + Del/Backspace, Duplicate + Ctrl/Cmd+D, New level (confirm). Inspector edits label, role, W/H/D, rotation (° → rad) via `updateVolume`. All disabled while locked. Preset select disabled when locked; custom level name shown if not a preset.
- **U15 Share/Save:** TopBar Share → `await shareUrl(level)` + clipboard toast; Save menu → `saveLevel` / `listSaves` / `loadSave` / `deleteSave` (R3 landed mid-task; wired to real API). Boot load from hash stays in Claude Code's `main.tsx` (`levelFromUrl`).

Files (Cursor only):
- `src/ui/panels/{EditTools,SidePanel,ShareSaveMenu,TopBar}.tsx`
- `src/ui/scene/Viewport.tsx`, `src/ui/viewPick.ts`
- `src/index.css`, `PLAN.md`, `HANDOFF.md`

Test: New level → Add cover at centre → edit size/rotation → Duplicate → Delete. Lock → tools disabled. Save → reload page → Open. Share → paste URL in new tab.

## 2026-10-03 — Claude Code — R3 (share links + saves)

`src/core/share.ts` (tests in `share.test.ts`, 26 tests pass in total):
- `await shareUrl(level)` → `https://…/#l=<code>`. The whole level is compressed into the link (~900 characters for Market Square). Prebaked models travel with it; the style image doesn't (too big), but the style notes do. **U15 Share button:** `navigator.clipboard.writeText(await shareUrl(level))` + toast "Link copied".
- Opening a link: `src/main.tsx` already calls `levelFromUrl()` on startup → `setLevel(...)`. Nothing to do in the UI.
- Saves (this browser only): `saveLevel(level) → boolean` (false = storage blocked; show a toast), `listSaves() → { id, name, savedAt, volumes }[]` (newest first), `loadSave(id) → Level | null` (then `setLevel`), `deleteSave(id)`.

## 2026-10-03 — Claude Code — R2 + R4 (AI co-designer is live in dev)

- **R2:** Prove snaps spawn/objective markers drawn on a wall to the nearest walkable cell (≤ 2 m), so sketch imports no longer give false NO_PATH.
- **R4:** AI server + client. Works in `npm run dev` now (key from `.env`). The public site gets it after the Vercel env var is set at the R2-M2 review.
  - Client `src/core/ai/client.ts`. Each call adds a `Proposal` to the store (ghost) and returns `{ proposal?, note?, model? }`. It throws `Error(message)` → show a toast.
    - `isAiAvailable()` → boolean (hide/disable AI buttons with the tooltip "AI not configured" when false)
    - `aiSketch(file)`: image → whole-layout proposal (`replaceAll: true`, `add` = all boxes, `previewProve`). ~8 s
    - `aiStyle(file)`: image → `styleNotes` proposal (applies even when locked). ~5 s. **Call it from the existing Style upload too.**
    - `aiCommand(text)`: e.g. "add a fountain near the well" → add/update/remove proposal + `previewProve`. ~6 s
    - `aiSuggestFix()`: failing level → one cover box that **passes** (`previewProve.status === "pass"`). ~2 s. Put a **"Suggest fix"** button on the fail banner.
    - When the AI has nothing to propose you get `note` (e.g. "This level already passes Prove.") → info toast.
  - Proposal card: show `why`, then `previewProve.message` (green if pass, red if fail), then **Accept / Reject**. For `replaceAll`, say "Replaces the current layout".
  - Images are downscaled to ≤1024 px JPEG inside the client; just pass the `File`.

## 2026-10-03 — Claude Code — R5 (Prove v2: line of sight + heatmap)

- Prove now computes **line of sight from the objective** (defender eye 1.7 m → crouching player 1.0 m; any solid taller than the line blocks it). A route point is **protected** if it's hidden from the objective OR near cover. The presets give the same results (fail 0%, pass 28%). New message: "Death corridor: only 0% of the 23 m route is protected (need 25%). 23 m in the open." Runs in 13–30 ms.
- **Heatmap data for U14** (new optional fields on `ProveResult`, see types.ts):
  - `exposure: number[]` (row-major, `exposureCols` × `exposureCols`, cell size `exposureCell` = 0.5 m): **1 = seen** (red), **0 = hidden** (blue/green), **-1 = inside a solid** (transparent).
  - Cell (col, row) centre = (−bounds + (col + 0.5)·cell, −bounds + (row + 0.5)·cell) in X/Z.
  - Suggested rendering: one 80×80 `DataTexture` on a ground plane at y ≈ 0.02, opacity ~0.35, `NearestFilter` (or Linear for a soft look). Rebuild when `prove.checkedAt` changes. Toggle "Show heatmap" (on by default after Prove).
  - `exposedMeters` = metres of the route in the open; nice in the banner.

---

## 2026-10-03 ~23:10 — Cursor — U12 (proposals)

Built: ghost boxes (dashed translucent) for `add`, ghost+arrow for `update`, red tint for `remove`; floating proposal cards with `why`, `previewProve` (pass/fail + %), **Accept / Reject** (layout Accept disabled while locked). `replaceAll` flagged.

Files: `src/ui/scene/ProposalGhosts.tsx`, `src/ui/panels/ProposalCards.tsx`, Viewport/CSS/uiPrefs.

## 2026-10-03 ~23:10 — Cursor — U13 (AI panel)

Built: SidePanel **Sketch → level** → `aiSketch`; TopBar Style upload also → `aiStyle` (proposal); command box → `aiCommand`; fail banner **Suggest fix** → `aiSuggestFix`. Loading + toasts; disabled when `!isAiAvailable()`.

Files: `src/ui/panels/AiPanel.tsx`, TopBar, ProveBanner, SidePanel.

## 2026-10-03 ~23:10 — Cursor — U14 (heatmap)

Built: ground `DataTexture` from `prove.exposure` (red=seen, blue=hidden, solids transparent); **Show heatmap** toggle (default on after Prove).

Files: `src/ui/scene/Heatmap.tsx`, uiPrefs, SidePanel, Viewport.

Test: Sketch → ghosts → Accept; fail Prove → Suggest fix → Accept → pass; Style image → Accept notes; Prove → heatmap toggle.


## 2026-10-03 — Claude Code — R7 (object photo → 3D), code done; live test pending re-login

- `regenerateFromImage(id, imageDataUrl)` in `src/core/dress/dress.ts`: Rodin **image-to-3D** for one box (photo or sketch of the object + the usual prompt). The model is still fitted inside the box. Live/local only (~2 min, 0.5 credits). On the public site it sets `status: "error"` with the "needs Hyper3D connection" message.
- Shared helper `toJpegDataUrl(file)` moved to `src/core/image.ts` (the AI client uses it too).
- **For Cursor (after U14, optional U16):** in the inspector, next to Regenerate, add **"From photo…"** (file input) → `regenerateFromImage(selectedId, await toJpegDataUrl(file))`. Same disabled state/tooltip as Regenerate when `isLiveAvailable()` is false.
- Server: the Rodin route writes the reference to `cache/ref/<key>.jpg` and passes `--image` to the CLI. It also finds the CLI next to node.exe now (no dependency on `npm root -g`).

---

## 2026-10-04 ~00:25 — Cursor — U16 (hero demo polish)

Built:
- Visual polish: brighter emissive ghost boxes; larger readable proposal cards (source label, Would pass/fail, green Accept).
- Inspector **From photo…** next to Regenerate → `regenerateFromImage(id, await toJpegDataUrl(file))`; same Hyper3D gate as Regenerate.
- AI loading: button spinners + “~5–10 s · Ns” on Sketch/Command/Suggest fix/Style.
- Heatmap legend bottom-left: red = seen by defenders, blue = hidden.

Files: SidePanel, ProposalCards, AiPanel, ProveBanner, ProposalGhosts, Viewport, TopBar, index.css, PLAN, HANDOFF.

Test: hero flow with clearer cards/ghosts/legend; From photo on cart (local Hyper3D only).

---

## 2026-10-04 ~01:00 — Cursor — U17 (R3-M1 shell)

Built:
- Design tokens (ink/panel/proof/danger/ai/amber, radii, type scale) + Space Grotesk / Inter Variable / JetBrains Mono.
- New shell: Stepper (top), Level panel (left, boxes grouped by role + search + inspector + edit tools), viewport + ViewportChrome (Orbit/Walk, heatmap, colliders), StepActionBar (bottom-centre), Co-designer panel (right placeholder with existing AI + proposals).
- Blueprint ground grid (cyan ~10% on ink floor) while greybox; cobble returns after dressed assets.
- `src/ui/workflow.ts`: local `currentStep` / `canVisitStep` until C9 store helpers land (soft-plugs store.currentStep when present).

Files: App, main, index.css, uiPrefs, workflow, panels/{Stepper,LevelPanel,CoDesignerPanel,StepActionBar,ViewportChrome,ProposalCards,SidePanel}, scene/{Viewport,Ground}, PLAN, HANDOFF.

Test: layout matches brief at desktop; stepper + action bar visible; blueprint grid on Market Square; Co-designer shows AI buttons.

---

## 2026-10-04 ~01:05 — Cursor — U18 (stepper + action bar + Prove card)

Built:
- Wired stepper to C9 `currentStep` / `canEnterStep` / `STEPS` (`blockout` id). Blocked steps show `why` in the tooltip.
- Step action bar per step: Block out (Add / Sketch / Presets / New), Prove (Run Prove), Lock (with lock explanation), Dress (style + Dress level), Play (Walk / Share / Export / Save).
- `ProveResultCard`: Pass/Fail, % protected, m exposed, message, Suggest fix on fail. Replaces the old top banner for prove/lock steps.

Files: workflow, Stepper, StepActionBar, ProveResultCard, Viewport, uiPrefs, index.css, PLAN, HANDOFF.

Test: Market Square opens on Prove → Run Prove → fail card with stats → Suggest fix; pass → Lock enables with reason on hover; Dress/Play gates match C9.

## 2026-10-04 — Claude Code — C9 (Round 3 foundations)

- **Installed:** `motion` (v14: `import { motion, AnimatePresence } from "motion/react"`), `lucide-react`, fonts. The fonts are already imported in `src/main.tsx`. Use these CSS names: `"Space Grotesk"` (500/600/700, headings + numbers), `"Inter Variable"` (UI text), `"JetBrains Mono"` (400/500, measurements).
- **Store helpers** (`src/core/store.ts`, tests pass, 36 total):
  - `STEPS` = `[{ id: "blockout" | "prove" | "lock" | "dress" | "play", label }]`, `currentStep(level)` (derived from the level, no extra state), `canEnterStep(level, step) → { ok, why? }` (the "why" text is ready to show on disabled steps).
  - `acceptAll(ids)`, `highlightedProposalId` + `setHighlightedProposal(id | null)` (hover/"Preview" on a proposal → highlight its ghosts).
- Next from Claude Code: C10, the Co-designer agent (`aiAgent(message, image?)` + `agentThread` in the store). I'll note the API here when it lands.

## 2026-10-04 — Claude Code — C10 (the Co-designer agent) — ready for U19

**One call does everything:** `aiAgent(message, image?)` from `src/core/ai/client.ts`. It never throws.
1. It pushes the user bubble + a pending agent bubble into `usePlaybound().agentThread`.
2. It calls `/api/ai/agent` with the level, the last 6 turns and the optional image.
3. It fills the agent bubble: `text` (1–3 sentences), `proposalIds` (look them up in `proposals`; each one is already a ghost), `chips` (2–3 follow-ups), `intent`, `model`. On failure it sets `error` on the bubble instead.

`AgentMessage` (store.ts): `{ id, role: "user" | "agent", text, imageThumb?, proposalIds?, chips?, intent?, model?, pending?, error? }`. Also `clearAgentThread()`.

**What the agent does (tested against Gemini, 6 of 6 cases):**
| You say | intent | Result |
|---|---|---|
| "Why does it fail?" | explain | Grounded answer from Prove data (sightline from the well, metres exposed), no proposals. ~2.5 s |
| "Fix the death corridor" | fix | 1 verified cover proposal (`previewProve.status === "pass"`). ~4 s |
| "add a flanking route on the east side" | edit | 1–3 ALTERNATIVE proposals, each validated + Prove-previewed. `why` ends with "(Changes: adds X, moves Y.)". ~8–10 s |
| image + "build this" | sketch | 1 `replaceAll` proposal. ~17 s (show a progress hint) |
| image + "use this look" | style | 1 `styleNotes` proposal. ~7 s |
| anything on a locked level | explain | Tells the user to unlock first |

**UI notes for U19:**
- Empty thread: show context chips from the brief (failing level: "Fix the death corridor", "Why does it fail?"…). After each answer, use that bubble's `chips`.
- Proposal rows inside the agent bubble: `why` + Prove badge (✓ Playable 28% / ✗ 0%) + **Preview** (`setHighlightedProposal(id)` on hover/click) + **Accept** / **Dismiss**; "Accept all" if > 1 (`acceptAll(ids)`). When several *alternatives* are offered (intent `edit`), label them "Option A / B / C" and suggest accepting one.
- A proposal that's gone from `proposals` (already accepted/dismissed) → show it as "Accepted ✓" / "Dismissed", greyed out.
- Pending bubble: thinking shimmer. Long ones (images) → "Reading your sketch… (~15 s)".
- The old `aiSketch / aiStyle / aiCommand / aiSuggestFix` still work. The **"Suggest fix" button on the Prove card** can now simply call `aiAgent("Fix the death corridor")` so the answer appears in the panel.

## 2026-10-04 ~03:30 — Claude Code — took over U19 + U20 (Cursor was idle; Francesco's call)

**Cursor: don't edit these files without reading this entry first.**
- **U19 Co-designer panel** (`src/ui/panels/CoDesignerPanel.tsx`, rewritten): a conversation over `agentThread`, with an empty state (what it can do + context chips), user/agent bubbles, a thinking indicator, errors with "Try again", proposal cards (tag, Prove pill, the "Changes:" line split out, Preview/Accept/Dismiss, Option A/B for alternatives, Accept all), "Suggestions" for proposals made outside the chat, a composer (Enter to send, image attach + drag-and-drop on the panel). Accepting a layout change re-runs Prove automatically. Outcomes are kept in `uiPrefs.proposalOutcome`.
- **Prove card:** "Suggest fix" and a new "Why?" both call `aiAgent(...)` and open the panel. The card animates in: a shake on fail, a green glow on pass.
- **U20 motion:** the route draws itself (`ProvePath`, 0.7 s), the heatmap fades in after it, ghosts are **violet** with a soft pulse and scale-in, previewing a proposal brightens its ghosts and dims the others (`highlightedProposalId`), and dressed models pop in (0.92 → 1). All of it respects reduced motion (`src/ui/motion.ts`).
- Styles: the "Co-designer conversation" block at the end of `src/index.css`.

---

## 2026-10-04 ~05:20 — Cursor — U21 (Round 4 polish)

Built:
- **Phone / tablet layout (≤960):** fixed Co-designer `position: relative` override that broke the bottom sheet; action bar / viewport chrome / legend / toast sit above the sheet using `--co-open-h` / `--co-collapsed-h` (no overlap when open or collapsed). Touch targets ≥ 40 px. Compact stepper on narrow screens.
- **Empty states:** blank level (“Start from a sketch… / preset / Add a box”), no search matches, nothing to dress / no models yet.
- **Polish:** Level panel search + spacing; lucide 16 px icons on EditTools, StepActionBar, ViewportChrome, ShareSaveMenu, inspector Regen/From photo; visible amber `action-why` under disabled Lock/Dress/Sketch; focus rings unchanged (amber inset).
- TopBar stubbed (unused since Stepper). Francesco Round 4 feedback was empty.

Files: `src/index.css`, LevelPanel, StepActionBar, Stepper, ViewportChrome, TopBar, EditTools, ShareSaveMenu, PLAN, HANDOFF.

Test at 390×844: open/collapse Co-designer — action bar clears the sheet; Level drawer does not cover the stepper; New level → empty state; search nonsense → no matches; Lock without pass → why text under button.

## 2026-10-04 ~05:40 — Claude Code — play links (core for B) + Co-designer guide

- `src/core/share.ts`: `playUrl(level)` → `…/#play&l=<code>`, `isPlayLink()`, `editorUrlFromPlay()`. Tested. **B (Play mode) is now Cursor's**: see `CURSOR_PROMPT_ROUND4B.md`.
- Co-designer: the "Step N of 5" guide card (what to do + what to expect + one action), exclusive Option A/B, image hints. `uiPrefs` now clears `stepOverride` automatically when `currentStep(level)` changes (fixes the action bar staying on "Run Prove" after a pass).
- A (bot replay) is in `src/ui/scene/BotReplay.tsx` + `src/ui/panels/ReplayCard.tsx`, styles in `src/ui/round4.css`.

## 2026-10-04 ~05:50 — Claude Code — D (undo / redo) + Hyper3D API

- `src/core/history.ts` (loaded in main.tsx): Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo. It covers every layout change (buttons, drag, inspector, accepted AI proposals); a drag counts as one step; it resets when another level is loaded; it is off while locked. Tests: `history.test.ts`.
- **For Cursor (optional, in EditTools):** Undo / Redo icon buttons (lucide `Undo2` / `Redo2`) → `useHistory().undo()` / `.redo()`, disabled when `useHistory().past.length === 0` / `future.length === 0` or the level is locked.
- Rodin now goes through the Hyper3D **HTTP API with `bbox_condition`** when `HYPER3D_API_KEY` is in `.env` (dev route); the CLI is the fallback. All 10 demo models are being re-prebaked through it (cache keys include `PIPELINE_VERSION = "bbox1"`).

---

## 2026-10-04 ~05:45 — Cursor — B (Play mode for share links)

Built:
- `App.tsx`: `isPlayLink()` → full-screen `<PlayMode />` (no editor).
- `src/ui/play/`: PlayMode (start → FPS run → win), PlayVolume (no labels/selection; gold beacon; dressed if `ready`), `play.css`.
- Win within 2 m of objective; timer + distance HUD; Play again / Open in editor (`editorUrlFromPlay`) / Make your own.
- Touch devices: “Play on a computer with a keyboard” + editor/home links.
- ShareSaveMenu: **Copy play link** + Copy link; Play step action bar: **Copy play link** is the main share action.

Files: App, `src/ui/play/*`, ShareSaveMenu, StepActionBar, PLAN, HANDOFF.

Test: Play step → Copy play link → open in new tab → Play → reach well → win card; editor link works.


## 2026-10-04 ~06:15 — Claude Code — bot model, C (Autopilot), B review

- **Bot model:** `public/assets/gen/bot-runner.glb`, a hooded thief made with the Rodin API + `bbox_condition` (0.7 × 1.8 × 0.5 m; raw bounds came back 0.79 × 1.89 × 0.55, so the proportions held). `BotReplay.tsx` loads it with `useGLTF` + `fitToVolume`; the capsule is the Suspense fallback. The ground ring now tints green/coral with the bot's state; "Spotted!" stays. `prebake --prune` keeps `bot-*` keys. **Still needs an eyeball check** that the model faces where it runs (it should face +Z).
- **C: Autopilot.** Logic: `src/core/ai/autopilot.ts` (tested). UI: `src/ui/panels/AutopilotTracker.tsx` + `autopilot.css`. Mounted in `CoDesignerPanel.tsx` with 3 lines: the "Build me a level" form shows while the thread is empty; while a run is active, the tracker replaces the Next-step guide. Steps: Layout → Prove → Fix → Lock → Style → Dress. Each step runs only when the designer clicks **Approve: …**; AI steps then wait for Accept in the thread. Fix shows as skipped when Prove passes first time. A style chosen *after* the new layout is required (the old level's notes don't count).
  - Server: `sketch` and `style` now also accept `{ text }` (layout / art direction from words); the agent has a new `build` intent and can write a style without an image; `AgentRequest.intent` forces an intent (the autopilot uses it so steps don't depend on the model's guess). `aiAgent()` now returns the proposals it added.
  - Tested live (dev): "a walled monastery courtyard" → 14-box layout (62% preview) → Accept → Prove pass → Lock → style written from the brief → Accept → Dress offered. I didn't run Dress, to save credits.
  - **For Cursor (optional):** the proposal tag shows "FROM SKETCH" for text-built layouts too; could read "FROM DESCRIPTION" when the user message didn't attach an image.
- **B review (Cursor's Play mode): works.** A play link opens the start card, then Play → HUD. Two fixes committed in `PlayMode.tsx`: touchscreen laptops were blocked as "touch devices" (`maxTouchPoints > 0`); now it blocks only when there is no fine pointer. The HUD said "0.0 m" before the first frame. Not fixed (minor): changing only the hash in the same tab doesn't switch editor → play (a new tab or a reload does).
- **Not deployed:** the working tree has Cursor's uncommitted work (store.ts canDress, DressStyleSetup in CoDesignerPanel, StepActionBar, round4.css). Deploy after Cursor commits.

## 2026-10-04 ~07:35 — Cursor — U22 (fluid, readable viewport)

Built:
- Labels now render only for spawn/objective plus the selected or hovered box; FPS renders no labels.
- Dressing uses a violet outline on queued/generating boxes, hover-only per-box text, and one action-bar counter (`Dressing 4 / 19`).
- Any pending `replaceAll` proposal fades the current layout to 15%, removes its labels/beacon/colliders, and restores it immediately on Dismiss.
- Canvas DPR is capped at 1.5 and the shadow map is 1024. Kept the default frameloop because route, bot, ghost, and model animations require continuous frames.
- Co-designer guide/thread/composer no longer overlap: the panel itself cannot be programmatically scrolled, and the guide body collapses while an image is attached or once the conversation starts.
- Non-preset levels show `Custom` in the preset selector while retaining their real name above it.
- Added Undo / Redo buttons wired to `useHistory`, disabled while locked or unavailable.

Files: `src/ui/scene/{VolumeMesh,Viewport}.tsx`, `src/ui/panels/{StepActionBar,LevelPanel,EditTools}.tsx`, `src/index.css`, `PLAN.md`, `HANDOFF.md`.

Test:
- `npm run typecheck` ✅
- `npm test` ✅ (10 files, 50 tests)
- `npm run build` ✅ (existing large-chunk warning only)
- Browser at 1036×502: attached Cambridge OSM image keeps composer visible; replacement preview had zero old-layout DOM labels; runtime Dress state showed one `Dressing 4 / 10` counter and zero per-box loading badges; FPS had zero labels.
- The live Cambridge AI request was interrupted by the concurrently changing dev server (`ERR_EMPTY_RESPONSE` while generated assets/manifest were updating), so replacement-preview behavior was also verified with a temporary runtime `replaceAll` proposal. No source fixtures were added.

Notes for Claude Code: no core/server/API or protected Round 4 files changed. The unrelated generated GLBs, manifest, and `CURSOR_PROMPT_ROUND5.md` working-tree changes were not staged.

## 2026-10-04 ~08:00 — Claude Code — Round 5 F1–F6 (Francesco's visual check)

- **`src/core/layout.ts` (new, tested):** `keepInside` (the whole footprint inside the map, rotation included; shrinks boxes bigger than the map), `overlaps`, `placeClear` (nudge up to 4 m, else null), `placeAll` (biggest first; spawn/objective never dropped), `MAP_SIZES` (40/60/80 m = bounds 20/30/40), `boundsForWidth`.
- **Server:** sketch/map/description layouts go through `placeAll` (no overlaps, nothing outside); the model first estimates the real width (`areaMeters`) so a map keeps its real scale, and names the level. Edits: moved/resized boxes and added boxes are placed clear of the rest. Fix search uses the same overlap rule. The agent can propose a map resize ("make the map 60 m" → a `bounds` proposal). Fix replies are the verified fix's own text. The prompt says old conversation may mention boxes that no longer exist.
- **Store:** `Proposal.levelName` / `Proposal.bounds` applied on Accept; `setMapBounds(b)` (refused while locked; keeps boxes inside); `agentContextAfter` = the last message before a layout was replaced / another level loaded, so the agent's history only covers the current level.
- Dress status: "Generating 3D" instead of the API's "jobs 1/6".
- Tested on the dev server with the Cambridge OSM image: name "Cambridge Market Square", map 80 m, 21 boxes, 0 outside, 0 overlaps; "add three carts" → all clear; resize 40 → 60 m; "build a large 80 m smugglers' harbour" → "Smuggler's Wharf", 80 m, 18 boxes. 58 tests pass.
- **Cursor:** U22 now also has #8 (map size picker → `setMapBounds`) and #9 (camera framing scales with `level.bounds`).
- Not committed: 17 new GLBs + manifest in `public/assets/gen/` from Francesco's local Dress of Cambridge (his call whether to keep them).
