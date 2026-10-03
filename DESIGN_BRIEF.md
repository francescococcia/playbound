# PLAYBOUND — Round 3 design brief (UI/UX + Co-designer)

Francesco's feedback (4 Oct, after testing Prove + Suggest fix): *"a bit ugly, the way of asking is confusing, the layout is not the best."* He wants a modern interface that looks designed by a person, with motion, and a **dedicated section for the AI agent**.

## 1. The core UX problem
Today every action is a button somewhere (top bar, side panel, banner, cards). A new user can't tell **what to do next** or **what the AI is for**. Fix: make the pipeline itself the navigation, and give the AI one home.

## 2. Layout (desktop)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ PLAYBOUND   ① Block out → ② Prove → ③ Lock → ④ Dress → ⑤ Play & share    │  ← stepper = navigation
├──────────────┬──────────────────────────────────────────┬─────────────────┤
│ LEVEL        │                                          │ CO-DESIGNER  ✦  │
│ ▸ Boxes list │            3D viewport                   │ ─────────────── │
│   (grouped   │                                          │ Agent status +  │
│   by role)   │   floating: view toggle, heatmap legend, │ conversation    │
│ ▸ Inspector  │   colliders toggle (bottom-left)         │ (cards)         │
│   (selected) │                                          │                 │
│              │   step action bar (bottom-centre):       │ Quick actions   │
│              │   the ONE primary action for this step   │ (chips)         │
│              │                                          │ [ ask anything ]│
└──────────────┴──────────────────────────────────────────┴─────────────────┘
```

- **Stepper (top):** 5 steps. Done = check mark, current = highlighted, future = muted but clickable when allowed. Each step changes the bottom **action bar** to its one primary action plus 1–2 secondary ones:
  1. *Block out:* Add box ▾ · Sketch → level · Presets / New
  2. *Prove:* **Run Prove** → result card (pass/fail, % protected, metres exposed) + heatmap on
  3. *Lock:* **Lock layout** (explains: "boxes can't move after this; the AI can only change looks")
  4. *Dress:* Style image + notes · **Dress level** · per-box progress
  5. *Play & share:* **Walk (FPS)** · Share link · Export zip
- **Left panel "Level":** boxes grouped by role (with colour chips and counts), search, inspector for the selected box. Edit tools live here (not the top bar).
- **Right panel "Co-designer":** the AI's only home (see section 4). Collapsible.
- **Phone:** stepper becomes a compact "Step 2 of 5 · Prove" header; panels become bottom sheets.

## 3. Visual direction: "blueprint workshop"
A level-design tool, not a SaaS dashboard. A greybox is a blueprint, so the UI borrows from **drafting tables**:
- **Colour:** deep ink-navy background (#0E1320), panels a step lighter (#151B2B), hairline borders (#25304A). Accents with meaning only:
  - **Proof green** (#3DDC97): pass, protected
  - **Danger coral** (#FF6B5A): fail, exposed, death corridor
  - **AI violet** (#A78BFA): anything the AI proposes (ghosts, cards, chips). The designer learns "violet = suggestion, not applied yet".
  - **Amber** (#F2C14E): objective / selection
- **Type:** *Space Grotesk* for headings and numbers (technical, characterful), *Inter* for UI text, *JetBrains Mono* for measurements (`1.2 × 1.2 × 2.5 m`).
- **Shape:** 10 px radius on panels, 8 px on controls; no heavy shadows, use 1 px borders + subtle inner glow on focus.
- **Icons:** lucide-react, 16 px, 1.75 stroke.
- **Viewport:** blueprint grid lines on the ground in greybox mode (cyan, 10% opacity); greybox boxes in desaturated role colours with crisp edges.
- **Avoid:** default purple gradients, emoji, glassmorphism everywhere, generic hero text, centered-everything layouts.

## 4. Co-designer panel (the agent)
One place for everything AI. Conversation-style but **every answer is actionable**.
- **Header:** "Co-designer" + status dot (online / thinking / offline: "AI not configured").
- **Context-aware quick actions (chips)** change with the step and the Prove result:
  - Block out: *"Build from my sketch"*, *"Add a flanking route"*, *"Add landmarks for orientation"*
  - Prove failed: *"Fix the death corridor"*, *"Why does it fail?"*
  - Prove passed: *"Make it more challenging"*, *"Check sightlines from the objective"*
  - Dress: *"Read style from an image"*, *"Suggest labels for generic boxes"*
- **Free text box:** "Ask the co-designer…" (Enter to send). Image drop zone on the panel (sketch or style).
- **Answer card:** short explanation, then **0–3 proposals**, each with: what changes (+2 boxes, moved cart), Prove preview (✓ Playable 31% / ✗ 12%), **Preview** (highlight the ghosts), **Accept**, **Dismiss**. "Accept all" when there are several.
- **Explain mode:** "Why does it fail?" answers in plain words using the Prove data ("the last 14 m before the well is in the open: defenders at the well see the whole corridor").
- **Never auto-applies.** Ghosts and cards are violet until accepted.

## 5. Motion (the `motion` library; respect `prefers-reduced-motion`)
Purposeful, fast (150–300 ms), ease-out:
- Stepper: progress line fills between steps; check mark draws in.
- Prove: the route **draws itself** from spawn to objective (~600 ms), then the heatmap fades in; the result card slides up.
- Fail: one subtle shake of the result card + coral pulse on the exposed stretch. Pass: green sweep along the route.
- AI thinking: three-dot shimmer in the card; ghosts **fade/scale in** (0.9 → 1) with a soft violet pulse until accepted; Accept morphs the ghost into a solid box.
- Panels: slide + fade; cards stagger in (40 ms).
- Dress: each box shows a progress ring, then the model pops in (scale 0.96 → 1).

## 6. Done when
- A first-time user can go sketch → proven → dressed → shared **without instructions**, guided by the stepper.
- Everything AI lives in the Co-designer panel and is visually distinct (violet).
- It looks crafted at 1440 px and works at 390 px.
