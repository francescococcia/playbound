Paste everything below the line into Cursor (Agent mode), with the `playbound/` folder open.

---

ROUND 4 of PLAYBOUND. Read the "ROUND 4" section of `PLAN.md` and the latest `HANDOFF.md` entries first (Claude Code rebuilt the Co-designer panel and added motion in U19/U20; don't redo that).

YOUR TASK: U21 polish. Same rules as before (branch `main`, commit only your own files, no push, no deploy).

FILES YOU OWN THIS ROUND (edit only these): `src/index.css`, `src/ui/panels/LevelPanel.tsx`, `src/ui/panels/StepActionBar.tsx`, `src/ui/panels/Stepper.tsx`, `src/ui/panels/ViewportChrome.tsx`, `src/ui/panels/TopBar.tsx`, `src/ui/panels/EditTools.tsx`, `src/ui/panels/ShareSaveMenu.tsx`.
Do NOT edit `CoDesignerPanel.tsx`, `src/ui/scene/*`, `src/ui/play/*`, `src/ui/round4.css`, `src/App.tsx`, or anything in `src/core/` (Claude Code is working there right now).

DO:
1. Phone layout (≤ 760 px and 761–960 px): the stepper, the Level drawer, the Co-designer bottom sheet and the action bar must not overlap; touch targets ≥ 40 px; test at 390 × 844.
2. Empty states: a blank level ("Start from a sketch in the Co-designer, a preset, or Add a box"), no search results, nothing to dress.
3. Polish per DESIGN_BRIEF.md: spacing and alignment in the Level panel, clear disabled reasons on the action bar, consistent icon buttons (lucide 16 px), focus rings.
4. Any notes Francesco writes under "Francesco feedback Round 4" in PLAN.md.

Run `npm run build` and `npm test` before each commit. Commit with `git add` + the exact files above + `PLAN.md HANDOFF.md`. Append a HANDOFF.md entry when done, then STOP.
