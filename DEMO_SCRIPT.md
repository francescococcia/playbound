# PLAYBOUND: demo video script + submission text (Sun 4 Oct, deadline 14:00 UK)

Target length **2:30 to 3:00**. Record locally (`npm run dev`, `.env` keys, `hyper3d auth login` first). 1440x900, voice-over live or after.
Credits on screen whenever the map is visible: **© OpenStreetMap contributors**, **Imagery © Google / Airbus, Maxar**, **Photos: Geograph, CC BY-SA 2.0**.

## Before you press record
- [ ] `npm run dev` running, `.env` has GEMINI_API_KEY + HYPER3D_API_KEY, Hyper3D login fresh.
- [ ] Files ready: `demo/westhub-satellite-120m.png`, `demo/westhub-photo.jpg`, `demo/guildhall-photo.jpg`.
- [ ] Backup models if Dress is slow: `demo-westhub-2views`, `demo-guildhall` (already generated).
- [ ] Fresh browser tab, window zoomed so the Co-designer panel is visible, notifications off.
- [ ] Do one dry run of the whole flow first; record the second.

## Shots

| Time | Show | Say |
|---|---|---|
| 0:00 | Title card: PLAYBOUND, "Prove the greybox. Then dress it." | "Level designers block out levels with grey boxes, then wait weeks for art. AI tools make one object at a time, or invent a layout the designer never approved. PLAYBOUND keeps the designer's layout as a contract." |
| 0:15 | Build me a level: attach the 120 m West Hub satellite map, type "start at the south end of JJ Thomson Avenue, goal is the West Hub entrance", Start | "I drop in a real place, a top-down map of West Cambridge, and tell it where to start and where the goal is. The AI proposes a greybox at real scale: every box has a role and an exact size in metres." |
| 0:35 | The layout appears over the map (floor = the map). Click Accept. Point at the credit | "Nothing changes until I accept. The map becomes the floor, so the scale is real." |
| 0:45 | Prove: red route, heatmap, "Death corridor", bot replay, "Spotted!" | "Prove is the safety net. A bot walks from spawn to goal, and a line-of-sight check from the goal shows what defenders see. This route is mostly in the open, so it fails, and the bot gets spotted." |
| 1:05 | Fix it / Suggest fix: ghost cover box, "Playable", Accept, Prove again: green, bot hides | "The AI proposes cover, but every suggestion is re-checked by Prove before I even see it. Now it passes." |
| 1:20 | Lock | "Only a passing layout can be locked. From here the AI can dress the level but cannot change the layout." |
| 1:30 | Style: attach a style image or type a look, then Dress. Boxes turn into models (use backup models if slow) | "Dress writes a prompt per box, its label, role, real size and the style, and Hyper3D Rodin generates the model, constrained to the box's size. Collision stays the box, so the art can't open a gap in the route." |
| 1:55 | From photo: add the West Hub photos (1 to 5) for one building | "For a real landmark I give it photos, and image-to-3D builds that building from multiple views." |
| 2:10 | Walk: first person, the Hidden / In cover / Seen pill, red edges when seen | "Walking the level is a stealth playtest. The same rule as Prove: hidden, in cover, or seen." |
| 2:25 | Share, Copy play link, open it: start card, Play, reach goal, "seen for N s" | "One click makes a playable link, so a designer can send a level to a teammate as a game. Export gives a zip for Unity, Unreal or Godot." |
| 2:40 | Credits slide + live URL + repo | "Built with Gemini for the co-designer and Hyper3D Rodin for 3D. Map data © OpenStreetMap contributors, imagery © Google, photos from Geograph, CC BY-SA." |

## Fallbacks
- AI slow or fails: re-run, or use the Market Square (fail) preset: Prove, bot spotted, Suggest fix, Accept, Prove green. This needs no AI to start.
- Dress slow: cut to the backup models, or say "prebaked" honestly.
- Don't promise: Prove is a heuristic (route exists and at least 25% of it is protected), not a combat simulation. Live Dress runs locally; the public site uses prebaked models.

## Submission form text

**Team name / members:** fill in yours (the form's "Neon Foxes, John, Sarah, Alex" and "Dreamweaver" are placeholders).

**Project name:** PLAYBOUND

**Project description (under 1000 characters):**

PLAYBOUND is "prove the greybox, then dress it": AI for level designers that cannot break the design. Designers block out a level with grey boxes, then wait weeks for art. Text-to-3D makes one object at a time with no idea of the level, and world generators invent a layout nobody approved. In PLAYBOUND the layout is a contract. A Gemini co-designer turns a sketch or a real top-down map (we demo West Cambridge) into boxes with roles and real sizes. A bot then proves it playable: route, line-of-sight heatmap, a "Spotted!" replay, and an AI fix that Prove re-checks. Only a passing layout locks. Hyper3D Rodin then dresses each box with a model built to that box's size, or from 1 to 5 photos of a real building. Collision stays the box, so art never changes the gameplay. Walk it as a stealth playtest, share a playable link, or export to Unity, Unreal or Godot. Every AI step is a proposal the designer accepts.

**Links:** live https://playbound-eta.vercel.app · repo https://github.com/francescococcia/playbound · video (add).

**Credits to mention:** OpenStreetMap contributors (ODbL), Google imagery, Geograph photos (CC BY-SA 2.0), Gemini, Hyper3D Rodin. Full list in `demo/CREDITS.md`.
