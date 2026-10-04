# Cursor: Round 5 · U22 "Fluid, readable viewport" (before the 11:00 freeze)

Read `PLAN.md` (Round 5) and the end of `HANDOFF.md` first. Same rules: branch `main`, commit **only your own paths** (never `git add -A`), don't push or deploy (Claude Code does), append a HANDOFF entry when done. **Don't edit** `src/core/**`, `server/**`, `api/**`, `src/ui/panels/CoDesignerPanel.tsx`, `src/ui/panels/AutopilotTracker.tsx`, `src/ui/scene/BotReplay.tsx`, `src/ui/panels/ReplayCard.tsx`, `src/ui/round4.css`, `src/ui/motion.ts` (Claude Code's). If you need a change there, write it in HANDOFF.

Francesco's visual check (Cambridge map, 19–21 boxes): the view is cluttered and heavy, and should feel more fluid and responsive. Concretely:

1. **Labels only when useful** (`src/ui/scene/VolumeMesh.tsx`): today every box shows a `<Html>` label, so 20 boxes = 20+ overlapping pills ("Market Stall Row…" ×8). Show a label only for the **selected** or **hovered** box, plus spawn and objective. In Walk (FPS) mode, show none. Each `<Html>` is a DOM element updated every frame, so fewer labels also means smoother orbiting.
2. **One quiet loading state while dressing:** instead of a "Queued" / "Loading…" pill on every box, show a soft pulse or outline on the box itself, and one overall counter in the action bar ("Dressing 4 / 19"). Keep the per-box text only on hover.
3. **Preview "Replaces the whole layout" properly** (`src/ui/scene/ProposalGhosts.tsx` / `Viewport.tsx`): while a `replaceAll` proposal is previewed (highlighted) or pending, **fade the current boxes to ~15% opacity and hide their labels**, so the new layout isn't drawn on top of the old one (Francesco: "it builds over the construction"). On Dismiss, everything comes back.
4. **Smoother canvas** (`Viewport.tsx`): cap `dpr={[1, 1.5]}`; shadow map 2048 → 1024; turn on `frameloop="demand"` only if it doesn't break animations (route draw-in, bot replay); otherwise leave it.
5. **Co-designer panel overlap** (CSS in `src/index.css`): in screenshot 1, the "Step 2 of 5" guide card covers the top of the thread ("…edges." is cut off). Give the guide its own space (not overlaying), or collapse it automatically once the thread has messages.
6. **Level name in the left panel:** after a layout is replaced, the panel shows the level's own name (Claude Code is making Accept set it, e.g. "Cambridge Market Square"). The PRESET dropdown should say "Custom" when the level isn't one of the presets.
7. Optional, only if 1–6 are done: Undo / Redo buttons in EditTools (lucide `Undo2` / `Redo2` → `useHistory().undo()` / `.redo()` from `src/core/history.ts`; disabled when `past` / `future` is empty or the level is locked).

Test: load `demo/cambridge-market-square-osm.png` in the Co-designer (drag onto the panel) → Preview shows only the new layout → Accept → orbit is smooth, labels appear on hover only → Dress shows one counter.
