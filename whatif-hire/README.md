# WhatIfHire

**"What if I hire someone at €32k?"** WhatIfHire answers that question before you sign.

## Problem
Founders hiring their first people in Italy:
- underestimate the real cost of a hire by 30–40% (INPS contributions, TFR severance, INAIL);
- miss tax deadlines (F24 on the 16th, UniEmens, CU, 770) and pay penalties;
- wait days for answers from consultants who charge by the hour.

## Solution
1. **What-if simulator:** enter a salary to see the real yearly cost, the employee's net pay, and the money split into 5 pots.
2. **AI assistant:** answers immediately and cites its source; risky questions go to a licensed consulente del lavoro.
3. **Deadline autopilot:** pots fill on payday and taxes are paid before they're due.

## Run the agent
```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...        # or: ant auth login
python -m whatif "What if I hire 2 engineers at £70k in March 2027?"
```
The agent calls the Seapoint tools (mock data for now), runs the what-if and answers. If it proposes a payroll-reserve move, you type `approve` to confirm. Every step is written to `audit.jsonl`.

Settings: `WHATIF_MODEL` (default `claude-opus-5-5`), `WHATIF_EFFORT` (default `medium`; use `low` for a faster live demo).

## Demo screen
Open `ui/index.html` in a browser. The activity feed is a scripted replay for now.

## Tests
```bash
python -m unittest
```

## Safety, enforced in code
- The agent can only **propose** money moves (`whatif/actions.py`); approval is typed by a person in the CLI.
- The system computes the amount (3 months of new payroll); the model can't choose it.
- Money only moves from the company's own main account into its own payroll pot, never to a new payee.
- A proposal is refused if it would leave too little to pay upcoming bills plus a £50k buffer.
- Each action has a one-time key, so approving twice moves the money once; a rejected action can't be approved.
- The R&D credit is excluded from the hiring decision.
- `audit.jsonl` records every question, tool call, proposal and decision.

## On the night: swap in Seapoint
Replace the functions in `whatif/seapoint_mock.py` with Seapoint MCP calls that return the same shapes. See the mapping table in `SPEC.md` §2.

See [EVALUATION.md](EVALUATION.md) for the CFO/CTO/product review, business model and demo script.

> Hackathon prototype. Figures are estimates, not tax or legal advice.
