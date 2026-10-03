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
