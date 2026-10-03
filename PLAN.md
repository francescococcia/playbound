# PLAYBOUND — build plan & task board

**Product:** Designers lock greybox boxes as gameplay contracts → a bot proves the level is playable → only then AI (Hyper3D Rodin) dresses each box with a mesh of the same size. Collision always stays the original boxes.
**Deadline:** Sun 4 Oct 2026, 14:00. Full spec: `../PLAYBOUND_BUILD_PROMPT.md`.

## How we work (read this first)

Two builders and one human:

| Who | Owns (only edits these) |
|---|---|
| **Claude Code** | `src/core/**`, `src/presets/**`, `api/**`, root config (`package.json`, `vite.config.ts`, `tsconfig.json`, `README.md`) |
| **Cursor** | `src/ui/**`, `src/index.css` |
| **Francesco (human)** | Tests each milestone, writes feedback below, decides what's next |
| Shared, edit with care | `src/App.tsx` (Cursor may change the layout), `PLAN.md` (status only), `HANDOFF.md` (append only) |

Rules:
1. `src/core/types.ts` is the **contract**. Don't change it. Need a change? Ask in `HANDOFF.md`.
2. The UI never edits `level` directly. Use the actions in `src/core/store.ts` (`usePlaybound`).
3. Need a new package? Write it in `HANDOFF.md`. Claude Code installs it (avoids lockfile clashes).
4. Take only tasks with your name. Status flow: `todo → doing → done`.
5. After each task, append to `HANDOFF.md`: what, files, how to test, notes for the other side.
6. **Stop at the end of each milestone** until Francesco writes feedback.

Run: `npm run dev` (app) · `npm test` (Prove tests) · `npm run build` (typecheck + build)

---

## M1 — See the level
*Done when Francesco can open the app, see the grey market square with labels, and walk around it in first person.*

| ID | Owner | Task | Status |
|---|---|---|---|
| C1 | Claude Code | Scaffold (Vite + React + TS + three/R3F/drei + zustand), `types.ts`, Market Square fail/pass presets, `store.ts`, `geometry.ts` | done |
| C2 | Claude Code | Prove: A* + cover check + tests (ahead of schedule for M2) | done |
| U1 | Cursor | `Viewport`: R3F canvas, 40×40 m ground with low edge wall, one box per volume coloured by `ROLE_COLORS`, floating labels, orbit camera. **Note:** `position` = bottom-centre → mesh y = `size[1]/2`. Spawn/objective drawn as flat markers (not solid). | done |
| U2 | Cursor | Click a box → select (highlight). `SidePanel`: volume list synced to selection + inspector (label, role, size). | done |
| U3 | Cursor | FPS mode: orbit/FPS toggle (`viewMode`), pointer lock, WASD ~4 m/s, eye height 1.6 m, start at the spawn. Collision **must** use `resolveCollision(x, z, 0.35, level.volumes, level.bounds)` from `src/core/geometry.ts`. | done |

**Francesco feedback M1:** M1 works (render, labels, selection + inspector, Prove fail/pass messages, Lock gate, FPS starts at the gate facing the corridor). Fix these before/with M2:
1. **Ground is pure black.** Boxes don't read. Use a mid-grey greybox ground with a 1 m grid (lines every 1 m, stronger every 5 m).
2. **Starting camera is too low and close.** Start with a high 3/4 overview that shows the whole square, gate → corridor → well. In the fail preset the cart (far NW corner) is hidden behind the clock tower.
3. **Labels:** sizes jump around with distance and overlap. Use a fixed screen size. Always show labels for spawn, objective and cover; for the rest, only on hover/selection.
4. **Top bar jumps:** Prove/Lock move when the message length changes. Give the message a fixed slot (or move it to the U4 banner).
5. **Objective is hard to spot.** Give the well a bright marker/beacon so "reach this" is obvious.
- Walking test (Francesco, by hand): FPS → click the view → hold W down the corridor → try to walk into the tavern wall (you should stop) → Esc. Result: ✅ WASD + wall collision work (Francesco, 3 Oct).

---

## M2 — Prove works
*Done when: Prove → red fail with reason; drag the cart next to the route → Prove → green pass → Lock.*

| ID | Owner | Task | Status |
|---|---|---|---|
| U4 | Cursor | Prove overlay: draw `prove.path`; segments green where `covered[i]`, red where exposed (the "heatmap"); banner with `prove.message`; small honest-limit line: "Prove = path + cover heuristic, not a combat sim." | done |
| U5 | Cursor | Drag a box on the ground (XZ only) when unlocked → `updateVolume(id, { position })`. Disabled when locked. | done |
| U6 | Cursor | TopBar: Style ref (file → data URL → `setStyleRef`) with thumbnail · Prove · Lock/Unlock · Dress (disabled, tooltip = `canDress(level).why`) · Export · Share (placeholders until M4). | done |
| C3 | Claude Code | Rodin access via the **Hyper3D CLI** (OAuth login, account credits; no API key, because the API needs the Business plan). Build a local dev-only route `/api/rodin` (Vite middleware) that runs `hyper3d generate` / `poll` / `result`, downloads the GLB to `public/assets/<hash>.glb`, and caches by `(prompt, size, style)` hash. Test with one real generation (~0.5 credits). | done |

**Francesco feedback M2:** M2 works. All 5 M1 fixes landed (readable ground/grid, overview camera, beacon on the well, stable top bar). Fail → red route + "Death corridor" banner; pass → green near the cart; Lock → Dress enabled → Dress pulls all 10 prebaked models ("Dress finished").
1. **Long labels overlap the scene** (e.g. the cart's full prompt-style label). Show a short display name in the 3D label (first ~3 words / max ~22 chars). Keep the full label in the inspector.
2. "Dress finished" shows but nothing changes visually yet. Expected: that's U7. Make U7 the top priority.
3. Note: in the fail preset the cart is now parked in plain view on the west side of the plaza (Claude Code moved it), ready to be dragged next to the route.
- Drag test (Francesco, by hand): Fail preset → drag the blue cart next to the red route, just past the corridor → Prove → green? Result: _(fill in)_

---

## M3 — Dress works
*Done when: Dress → each box becomes a real model of the same size; colliders still match the boxes.*

| ID | Owner | Task | Status |
|---|---|---|---|
| C4 | Claude Code | `src/core/dress/`: prompt builder (spec template), queue (concurrency 3), `dressLevel()` + `regenerate(id)` that call `/api/rodin` and update status via `setVolumeAsset`. When the route is missing (public deploy), fall back to the cached assets and set status `error` with "Live generation needs a Hyper3D connection". | done |
| C5 | Claude Code | `fitToVolume(object3D, volume)`: scale/centre any GLB to the box size. This is the "AI can't break the layout" guarantee. | done |
| U7 | Cursor | Render a GLB when `assetUrl` is set (`useGLTF` + `fitToVolume`), hide the grey box, "Show colliders" wireframe toggle, per-volume progress list. | done |
| U8 | Cursor | Environment: HDRI sky (drei `Environment`) + textured ground (HY-World is out of scope). | done |

**Francesco feedback M3:** M3 works. Dress turns the square into Rodin models; Show colliders draws the contract boxes around them; the FPS view down the dressed corridor looks great (a strong video shot).
- Bug found + fixed by Claude Code: all models stacked in the middle of the square. Cause: `fitToVolume` measured in world space; it now measures in parent space (regression test added). No change needed in `DressedModel`.
1. **FPS view is cluttered for the video:** in FPS, hide the Prove banner (or fade it after ~3 s), the path line, and all labels except the objective.
2. Next: M4 (U9 inspector: prompt + Regenerate; Export button wired once C6 lands).

---

## M4 — Regenerate + export

| ID | Owner | Task | Status |
|---|---|---|---|
| C6 | Claude Code | Export: zip with `level.json` + GLBs (jszip). | done |
| U9 | Cursor | Inspector: prompt text, **Regenerate** button → `regenerate(id)`, spinner. Export button wired. | done |

**Francesco feedback M4:** U9 + FPS declutter work. The inspector shows label/role/size/status and the full Rodin prompt. **Live Regenerate tested end to end** (cart → new Rodin variant in ~2.5 min, swapped in place, 0.5 credits). The variant was then pruned so Regenerate stays genuinely live for the video.
Still missing (Cursor's M4 entry was written before C6 landed):
1. **Export button:** wire it to `downloadLevelZip(level)` (see the C6 entry in HANDOFF.md), with a spinner.
2. **Drag threshold:** start a drag only after the pointer moves > ~5 px, so a plain click only selects (accidental drag moved the hay bales).
Then U10 polish. Stop after and tell Francesco what to test.

---

## M5 — Live + demo

| ID | Owner | Task | Status |
|---|---|---|---|
| C7 | Claude Code | Deploy to Vercel (static site + prebaked GLBs in `public/assets/`). README: how to log in to the CLI, prebake, limits, demo script. | done |
| C8 | Claude Code | Prebake hero level: generate ≥ 6 (target 9) Rodin assets via CLI/MCP, commit the GLBs, reference them from the preset. | done |
| U10 | Cursor | Polish pass: readable labels, loading states, phone-width check. | done |
| H1 | Francesco | Record the 2-minute demo video (script in the spec). | todo |

---

# ROUND 2 — from demo to tool (started 3 Oct, evening)

**Goal:** the AI helps at every stage, and the designer always approves.
**Hero demo:** upload a sketch → AI builds the greybox → Prove fails (death corridor) → AI suggests cover → Accept → Lock → style image → AI writes the style → Dress → walk → share the link.

**Rules (unchanged + git):**
- Same folder, same branch (`main`). **No branches.**
- Commit ONLY your own paths: Cursor → `git add src/ui src/index.css src/App.tsx PLAN.md HANDOFF.md`; never `git add -A` / `git add .`.
- Cursor does NOT push or deploy. Claude Code pushes to GitHub and deploys after each milestone review.
- Contract changes (`src/core/types.ts`) only by Claude Code; ask in HANDOFF.md.
- **AI proposals are never applied automatically:** `addProposal` → designer clicks Accept (`acceptProposal`) or Reject.

## R2-M1 — Editing + share/save
*Done when: Francesco can start a blank level, add/resize/rotate/delete boxes, save it, reload it, and open a share link in another tab.*

| ID | Owner | Task | Status |
|---|---|---|---|
| R1 | Claude Code | Store: `addVolume(role, pos?, patch?)`, `removeVolume`, `duplicateVolume`, `newLevel`, `setLevel`, `DEFAULT_SIZE`; `Proposal` contract + `addProposal / acceptProposal / rejectProposal / clearProposals` (tests) | done |
| R3 | Claude Code | `src/core/share.ts`: `shareUrl(level)` (level compressed into the URL hash), `levelFromUrl()` on boot; `saveLevel / listSaves / loadSave / deleteSave` (browser storage) | done |
| U11 | Cursor | Edit tools: **Add** menu (role picker → `addVolume` at the view centre), **Delete** (button + Del key), **Duplicate** (button + Ctrl+D), inspector fields for label, role, W/H/D, rotation (°) → `updateVolume`; **New level** button. All disabled while locked. | done |
| U15 | Cursor | **Share** button → copy `shareUrl(level)` + toast; **Save / Open** menu (list saves, load, delete). Uses R3 (wire when R3 lands; placeholder until then). | done |

**Francesco feedback R2-M1:** works

## R2-M2 — AI co-designer (Gemini)
*Done when: sketch → ghost greybox → Accept; "Suggest fix" on a failing level proposes cover that passes; style image → style notes proposal; text command works.*

| ID | Owner | Task | Status |
|---|---|---|---|
| R2 | Claude Code | Prove robustness: snap spawn/objective to the nearest walkable cell (sketch imports put the gate on the wall → false NO_PATH) | done |
| R4 | Claude Code | AI server (`/api/ai/*`): one handler for the Vite dev server AND a Vercel function, key server-side, usage cap. `sketch` (image → replaceAll proposal), `style` (image → styleNotes proposal), `command` (text + level → add/update/remove proposal), `fix` (agent loop: model proposes cover spots → our Prove checks each → best passing one, with `previewProve`). Client: `src/core/ai/client.ts` → `aiSketch(file)`, `aiStyle(file)`, `aiCommand(text)`, `aiSuggestFix()`, `isAiAvailable()`. Each adds a proposal to the store. | done |
| U12 | Cursor | Proposal UI: ghost boxes (translucent, dashed) for `add`, ghost + arrow for `update`, red tint for `remove`; proposal card(s) with `why`, Prove preview (pass/fail, %) and **Accept / Reject**. | done |
| U13 | Cursor | AI panel: **Sketch → level** (image upload), **Style from image** (the style upload also calls `aiStyle`), command box, **Suggest fix** button on the fail banner. Loading states (10–30 s), errors as toasts. | done |

**Francesco feedback R2-M2:** Reviewed by Claude Code (4 Oct, ~00:00): the hero flow works end to end in the real UI. Sketch → 6 ghost boxes → Accept → Prove "Death corridor 0%" → **Suggest fix** → Accept → Prove "Playable 27%". Text command ("stone fountain near the well") ✅, style image → notes ✅, heatmap toggle present. **Live site AI works** (existing Vercel key is valid): style 5.8 s, fix 2.2 s.
- Fixed by Claude Code: the Vercel AI function crashed (ESM imports without `.js`).
- Francesco: check the visuals by eye (ghost boxes, cards, heatmap colours) and add notes here: _(fill in)_

## R2-M3 — Prove v2 (line of sight + heatmap)
| ID | Owner | Task | Status |
|---|---|---|---|
| R5 | Claude Code | Line of sight from the objective through solid boxes; `prove.exposure` grid for the heatmap; a route point is protected if hidden from the objective OR near cover (kept the cover radius so the presets still behave). Presets re-tuned so fail/pass still hold (tests). | done |
| U14 | Cursor | Heatmap overlay on the ground from `prove.exposure` (red = seen, blue = safe) + toggle. | done |

**Francesco feedback R2-M3:** _(write here)_

## R2-M4 — Ship
| ID | Owner | Task | Status |
|---|---|---|---|
| R6 | Claude Code | Gemini key in Vercel (server-only), deploy, README update, demo rehearsal | todo |
| R7 | Claude Code | Bonus: object image → Rodin image-to-3D for one box (local) | todo |
| U16 | Cursor | Polish pass for the hero demo flow | todo |
| H1 | Francesco | Record the demo video | todo |

---

## Known facts (keep updated)
- **Hyper3D CLI login expires after a few hours** ("Authentication expired"). Run `hyper3d auth login` again before any live generation, especially right before recording the demo.
- **AI co-designer measured (3 Oct, Gemini 3.8 Flash):** sketch → level 8 s, style → notes 5 s, command 6 s, fix 1.4 s (fast mode; verified by Prove, with a search fallback if the AI fails). Sketch of the market square comes back as a "death corridor" (0%), which is the hero demo. Usage cap: 30 requests / 10 min per visitor, 400 / day per server.
- **AI provider test (3 Oct):** sketch → greybox JSON works on every model tested (6 boxes, right roles, positions within ~1 m). Speed: **Gemini 3.8 Flash direct 12 s (free)**, Cursor SDK + Claude Sonnet 5.5 27 s, Cursor SDK + Gemini 3.8 Flash 94 s. Cursor SDK on Windows needs `JsonlLocalAgentStore` (default SQLite path exceeds MAX_PATH); its custom tools were blocked by `tools: []`. Decision: **Gemini direct** for the app (free, fastest, works on the public site); the "fix" agent loop runs in our code (model proposes → our Prove checks).
- **Live URL:** https://playbound-eta.vercel.app (Vercel project `playbound`, account francescococciaa-1965). First deploy: 3 Oct ~16:20. Deploys upload the working tree, so **deploy only when Cursor has stopped at a milestone** (no half-done UI). Command: `npx vercel deploy --prod --yes`. `/api/rodin` doesn't exist there (404), so Dress uses prebaked models and Regenerate shows the "needs Hyper3D connection" message.
- **Rodin via CLI, measured 3 Oct:** ~2 min per model, 0.5 credits. Raw GLB is 28 MB / 375k verts; after our optimize step it's ~1.2 MB (meshopt + 1K webp). Models come back centred on their middle at arbitrary scale, so `fitToVolume` is required. Credits: 25 regular + 300 subscription.
- **Prebake (3 Oct, 2 rounds, ~6 credits):** 10 assets, ~5.5 MB in total. Fill: tower 94%, chapel 95%, tavern 81%, guildhall 76%, cart 75%, fish stall 64%, bakery 60%, hay 42%, notice board 37%, barrels 100%. Each side of the corridor is now two 9 m buildings (tavern + bakery, chapel + guildhall). `fitToVolume` allows ≤25% sideways stretch.
- **Dev tools:** `/dev-viewer.html` = gallery of every prebaked model inside its contract box (`?only=cart,hay` to focus). `/dev-viewer.html?k=<key>` previews one raw asset. `public/assets/gen/manifest.json` lists every generated asset.
- **Hyper3D access (3 Oct):** Rodin API = Business plan only, which we don't have. We use the **Hyper3D CLI** (`@hyper3d/cli`, `hyper3d auth login`) and the **Hyper3D MCP** (`https://api.hyper3d.com/api/mcp`, OAuth). Both spend account credits (~0.5 credits per Gen-2.5 model).
  - The CLI has no bounding-box option, so the size guarantee comes from `fitToVolume` (C5): each GLB is scaled to its contract box.
  - Live Regenerate works when the app runs locally (demo video). The public URL serves prebaked assets.
  - Open question: ask Hyper3D on Discord for temporary hackathon API access. If granted, swap the CLI for the API (`bbox_condition`) in `/api/rodin`. The UI doesn't change.
- Prove constants: `src/core/prove/constants.ts` (cell 0.5 m, cover radius 2.5 m, need 25% covered, agent radius 0.4 m).
- Fail preset: 23 m route, 0% covered → `NO_COVER`. Pass preset (cart at x 1.6, z −2): 28% → pass.
- To make the drag demo pass, place the cart within about 1–2 m of the route between the corridor and the well.
