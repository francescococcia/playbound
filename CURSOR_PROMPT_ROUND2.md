Paste everything below the line into Cursor (Agent mode), with the `playbound/` folder open.

---

ROUND 2 of PLAYBOUND starts now. You are still working with Claude Code in the SAME folder, at the same time.

READ FIRST: `PLAN.md` (the section "ROUND 2" at the top of the round), the latest entries in `HANDOFF.md`, `src/core/types.ts` (new: `Proposal`), `src/core/store.ts` (new actions: addVolume, removeVolume, duplicateVolume, newLevel, setLevel, DEFAULT_SIZE, proposals + addProposal/acceptProposal/rejectProposal/clearProposals).

RULES (same as before, plus git):
- Only edit `src/ui/**`, `src/index.css`, `src/App.tsx`. Never edit `src/core/**`, `src/presets/**`, `server/**`, `scripts/**`, `package.json`. Need something there? Ask in HANDOFF.md and continue with another task.
- Git: same branch (`main`), NO new branches. Commit ONLY your files:
  `git add src/ui src/index.css src/App.tsx PLAN.md HANDOFF.md` then `git commit -m "..."`.
  Never `git add -A` / `git add .` (Claude Code has uncommitted work in the same folder). Do NOT push and do NOT deploy: Claude Code does that after review.
- Commit after each finished task (small commits), with a message starting with the task ID (e.g. "U11: edit tools").
- AI suggestions are never applied automatically: UI shows them as ghosts and only `acceptProposal(id)` applies them.
- Update the Status cells in PLAN.md (todo → doing → done) and append to HANDOFF.md after each task.
- Run `npm run build` and `npm test` before each commit. Both must pass.
- STOP at the end of each milestone (R2-M1, R2-M2, ...) and tell me what to test.

START NOW with R2-M1: U11 (edit tools), then U15 (share/save — wire to `src/core/share.ts` when Claude Code's R3 lands; use a placeholder until then).
