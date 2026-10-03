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
