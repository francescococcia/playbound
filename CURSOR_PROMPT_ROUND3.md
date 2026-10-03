Paste everything below the line into Cursor (Agent mode), with the `playbound/` folder open.

---

ROUND 3 of PLAYBOUND: redesign the experience. Same collaboration rules as Round 2 (same folder and branch `main`, commit ONLY your own paths, no push, no deploy, contract changes by Claude Code).

READ FIRST, carefully: `DESIGN_BRIEF.md` (this is the source of truth for layout, look and motion), the "ROUND 3" section of `PLAN.md`, the latest `HANDOFF.md` entries.

GOAL: a first-time user goes sketch → proven → dressed → shared without instructions. It must look crafted by a person ("blueprint workshop" direction in the brief), not a generic template.

DO R3-M1 NOW:
- U17: design tokens as CSS variables (colours, radii, spacing, type scale from the brief), fonts, the new layout shell: stepper (top), "Level" panel (left), viewport with floating controls (centre), step action bar (bottom-centre), "Co-designer" panel (right, placeholder for now). Blueprint grid on the ground in greybox mode.
- U18: stepper + action bar per step with one primary action each, disabled states that say WHY, and a Prove result card.
Claude Code is installing `motion`, `lucide-react` and the fonts (task C9) and adding store helpers (`currentStep`, `acceptAll`, `highlightedProposalId`). Pull them in when they land in HANDOFF.md; until then, structure the code so they plug in.
Keep all existing features working (edit tools, share/save, export, AI buttons can temporarily live in the Co-designer placeholder).

Commit after each task (`git add src/ui src/index.css src/App.tsx PLAN.md HANDOFF.md`). Run `npm run build` and `npm test` before each commit. STOP at the end of R3-M1 and tell me what to test.
