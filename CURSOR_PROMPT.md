Paste everything below the line into Cursor (Agent mode), with the `playbound/` folder open.

---

You are building PLAYBOUND in this folder (`playbound/`) together with Claude Code, which works in the same folder at the same time.
PLAYBOUND: designers lock greybox boxes as gameplay contracts → a bot proves the level is playable → AI dresses each box with a 3D model of the same size. Collision always stays the original boxes.

BEFORE ANYTHING: read `PLAN.md`, `HANDOFF.md`, `src/core/types.ts`, `src/core/store.ts`, `src/core/geometry.ts`.

RULES
- You only edit `src/ui/**` and `src/index.css` (plus the layout in `src/App.tsx` if needed).
- Never edit `src/core/**`, `src/presets/**`, `api/**`, `package.json` — Claude Code owns them. Need a change or a new npm package? Write the request in `HANDOFF.md` and carry on with something else.
- `src/core/types.ts` is the shared contract: read it, don't change it.
- The UI never mutates `level` directly. Use the actions from `usePlaybound()` in `src/core/store.ts`.
- FPS collision must use `resolveCollision()` from `src/core/geometry.ts`.
- Only take tasks in `PLAN.md` with Owner = Cursor. Set them to `doing` when you start and `done` when finished (edit only the Status cell).
- After each task, append an entry to `HANDOFF.md` (format at the top of that file).
- Run `npm run build` before marking a task done. It must pass.
- STOP at the end of each milestone and tell me what to test. Wait for my feedback in `PLAN.md`.

START NOW with M1: tasks U1, U2, U3.
Style: dark, functional editor UI. Greybox boxes coloured by `ROLE_COLORS`, readable labels. No landing page.
