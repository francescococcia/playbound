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
