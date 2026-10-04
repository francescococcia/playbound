Paste everything below the line into Cursor (Agent mode), with the `playbound/` folder open.

---

Thanks for U21. Next task in ROUND 4: **B, Play mode for share links** (see PLAN.md → ROUND 4 and the newest HANDOFF.md entry from Claude Code). Same rules as before (branch `main`, commit only your files, no push, no deploy).

WHAT: a level opened from a **play link** (`#play&l=...`) becomes a small GAME, with no editor visible. This is what we show the Arcade judges: "the output of the tool is a playable link".

CORE IS READY (in `src/core/share.ts`, don't edit it): `playUrl(level)` builds the link, `isPlayLink()` tells you the page was opened from one, `editorUrlFromPlay()` gives the editor link for the same level. `src/main.tsx` already loads the level from the hash on startup.

BUILD:
1. `src/App.tsx`: if `isPlayLink()` is true, render `<PlayMode />` instead of the editor shell.
2. New folder `src/ui/play/` (all yours):
   - `PlayMode.tsx`: a full-screen 3D view reusing the existing scene pieces (Ground, VolumeMesh / DressedModel, Environment). **No** heatmap, ghosts, proof route, bot or labels (except a gold beacon on the objective). Use the existing FPS controller with `resolveCollision` (collision stays the boxes).
   - Start screen: level name, "Reach the gold beacon", controls (WASD + mouse, Esc), a big **Play** button (pointer lock starts on click).
   - HUD: timer (mm:ss.s), distance to the objective, a small "PLAYBOUND" mark.
   - Win: when the player is within ~2 m of the objective → "Objective reached in 14.2 s" + **Play again** + **Open in editor** (`editorUrlFromPlay()`) + "Make your own" (the site root).
   - Dressed models: if the level has prebaked models (`status: "ready"`), show them; otherwise greyboxes in the blueprint style.
   - Phone: on touch devices show a simple message ("Play on a computer with a keyboard") plus Open in editor. A virtual joystick is not needed.
   - Styles in `src/ui/play/play.css` (import it from PlayMode). Use the tokens from `src/index.css`.
3. `src/ui/panels/ShareSaveMenu.tsx`: add **"Copy play link"** (`navigator.clipboard.writeText(await playUrl(level))` + toast) next to Copy link. In step 5 (Play & share) of `StepActionBar`, make "Copy play link" the main share action.

DON'T EDIT: `src/core/**`, `src/ui/panels/CoDesignerPanel.tsx`, `src/ui/scene/BotReplay.tsx`, `src/ui/round4.css`, `server/**` (Claude Code is working there).

Run `npm run build` and `npm test` before each commit. Commit (`git add src/App.tsx src/ui/play src/ui/panels/ShareSaveMenu.tsx src/ui/panels/StepActionBar.tsx src/index.css PLAN.md HANDOFF.md`), add a HANDOFF.md entry, mark B done in PLAN.md (owner Cursor), then STOP and say what to test.
