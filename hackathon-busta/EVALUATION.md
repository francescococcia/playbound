# Busta: idea evaluation and hackathon plan

**Idea:** payroll and labour-admin autopilot for founders and early startups. It includes an AI assistant that answers right away, a licensed consultant as backup, and a guided "split" of every payroll euro into salary, taxes, contributions and TFR.

**One-liner for the pitch:** "Founders lose days and thousands of euros to payroll paperwork and to consultants who don't answer. Busta shows the real cost of every hire, sets the money aside before each deadline, and answers labour questions in seconds."

> I couldn't open the Luma page from the build environment, so the event's tracks, judging criteria and required APIs are unknown. Check the "Must do before you start" list below against the event page.

## Verdict
**Worth building, if the angle is sharp enough.** Plain payroll is a crowded market. Busta stands out with two features: guaranteed fast answers (AI first, consultant backup) and automatic money splitting before each deadline. Pitch those two features, not "payroll software".

## CFO view
- **Pain is real and costly.** An Italian hire on a €30k RAL costs about €41k a year (employer INPS ~30%, TFR, INAIL). Founders often underestimate this by 25–35%. Missed F24 payments bring penalties and interest.
- **Revenue model:** €15–25 per employee per month, plus a €49/month base fee per company. Consultant time is bundled into the price (no hourly billing).
- **Unit economics risk:** the human consultant is the main cost. AI has to resolve most questions for margins to work. Target ≥70% of questions resolved without a human.
- **Money movement:** holding client funds in pots requires a PSD2/EMI licence. Use a banking-as-a-service partner (e.g. Swan, Treezor, Stripe Treasury) instead of holding funds yourself.

## CTO view
- **Hackathon MVP (what to build):** (1) a cost and split calculator, (2) a RAG assistant over Italian labour sources (INPS circulars, CCNL texts, Agenzia Entrate) with citations and a confidence threshold that triggers handoff, (3) a deadline calendar. The prototype here mocks (2) with canned answers. Swap in an LLM plus retrieval if time allows.
- **Real product stack:** payroll engine via a partner API or a licensed consultant's software (Zucchetti/TeamSystem exports) rather than building CCNL rules yourself. Open banking for the pots. Document generation for payslips (LUL), UniLav and UniEmens.
- **Hard parts:** about 900 CCNL agreements with different rules, and data protection (GDPR: payroll data includes health and family information).

## Product view: what's missing from the idea
1. **Legal gate (critical):** in Italy, payroll processing is reserved to licensed professionals (consulenti del lavoro and similar, L. 12/1979). Busta must run *with* consultants, either as a partner network or with a consultant on staff. Turn this into a strength: "a real consultant signs every payroll run."
2. **Target customer:** choose one group, e.g. Italian startups with 1–20 employees, often first-time employers. Don't start with "all SMEs".
3. **Clear wedge vs competitors:** Jet HR (Italy), Factorial and Personio cover HR/payroll; Deel and Remote cover international hiring. Your edge: founder-first, cash-flow pots, and an answer-time guarantee.
4. **Trust and liability:** who pays if the AI is wrong? Define the escalation rules, show sources on every answer, and get professional liability insurance through the consultant partner.
5. **Measure success by:** time to answer, deadlines met, setup time for the first hire.

## Must do before you start (check on the Luma page)
- [ ] Theme or track fit. If there's a fintech or AI track, pitch the assistant plus the pots.
- [ ] Judging criteria. Weight the demo toward whatever they score (usually impact, tech, design, pitch).
- [ ] Required sponsor APIs or tools. Plug them into the assistant if possible.
- [ ] Submission format and deadline (repo link, video, slides).

## 3-minute demo script
1. **Pain (30s):** "I hired my first employee and spent 3 weeks chasing my consultant."
2. **Cost splitter (60s):** enter €32k and show the real cost and the 5 pots.
3. **Assistant (60s):** ask "When do I pay the F24?" to get an instant answer with its source. Then ask "Freelancer or employee?" to show the handoff to a consultant.
4. **Calendar plus business model (30s):** deadlines handled automatically, €20 per employee per month, consultant network.

## Files
- `index.html`: clickable prototype. Open it in a browser; no build step needed.
