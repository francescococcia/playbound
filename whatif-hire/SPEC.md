# WhatIfHire: build spec and hackathon audit

> "What if I hire 2 engineers in March?" An agent that does the fractional CFO's
> hiring-and-runway job on Seapoint data. It reads, simulates, prepares the
> board slide and the cash, and moves money only after you approve.

## 0. Rule check (do this first)
- [ ] Ask the organisers whether code written before 18:20 is allowed. If it isn't, use this spec and the tests as the plan and rebuild during the event. Everything here is small enough for that.
- [ ] Ask whether the Seapoint sandbox allows **write** actions (moving money to a pot, scheduling a bill). If it doesn't, the approval step produces a signed instruction instead of a real transfer.
- [ ] Get the Seapoint MCP tool list and fill in the table in §2.

## 1. Parameters

### From the founder (each question)
| Parameter | Example | Default if not given |
|---|---|---|
| Role | Engineer | required |
| Number of hires | 2 | 1 |
| Gross salary (GBP) | 70,000 | required |
| Start month | 2027-03 | next month |
| Share of time on R&D | 0.8 | 0 for non-technical roles, 0.8 for engineers (agent asks to confirm) |

### Company settings (set once)
| Setting | Default | Why it matters |
|---|---|---|
| Minimum runway | 12 months | Safety line: the agent warns and refuses to recommend below it |
| Financial year end | March | When the R&D credit can be claimed |
| R&D credit payout lag | 6 months after year end | Cash timing |
| R&D-intensive company (ERIS) | No | 27% vs 16.2% credit rate |
| Payroll reserve to set aside | 3 months of new payroll cost | Size of the proposed reserve move |
| Auto-approve limit | £0 (every money move needs approval) | Oversight |
| Burn basis | Last 3 months' average | Forecast method |

### UK rules (2025/26 rates, checked in tests)
Employer National Insurance is 15% above £5,000 a year. The employer pension is 3% of earnings between £6,240 and £50,270. R&D credit: 16.2% net under the merged scheme for a loss-maker, 26.97% under ERIS.

### From Seapoint (read by the agent)
| Data | Used for |
|---|---|
| Account balances | Cash today |
| Monthly cash in and out | Net burn |
| Burn and runway | Cross-check against our own figure |
| Bills (due, pending) | Short-term cash needs before the start date |
| Invoices (sent, overdue) | Collection risk: the agent drafts a reminder for overdue ones |
| Treasury pots | Where the payroll reserve goes |

## 2. Seapoint tool mapping (fill in on the night)
| Our function (`seapoint_mock.py`) | Seapoint MCP tool | Read or write |
|---|---|---|
| get_balances | ? | read |
| get_monthly_cashflow / list transactions | ? | read |
| get_burn_runway | ? | read |
| list_bills | ? | read |
| list_invoices | ? | read |
| list_treasury_pots | ? | read |
| move_to_pot (new) | ? | **write: approval required** |

## 3. How we score on each criterion

### Agent autonomy
The agent decides its own steps. We do not hard-code a pipeline.
1. **Plans:** works out which Seapoint data the question needs and fetches it.
2. **Analyses:** runs the what-if, then **searches for the earliest safe start month** if the asked-for month breaks the 12-month minimum.
3. **Spots risks on its own:** overdue invoices, a cluster of bills before the start date, R&D credit arriving after cash runs out.
4. **Produces finished work, not just answers:** a board-pack runway slide, a proposed reserve move, and a reminder email draft for overdue invoices.
5. **Acts:** carries out the reserve move after approval.
6. **Stretch goal:** a weekly check, "Is the hiring plan still affordable?", that re-runs itself and alerts you only when the answer changes.

### Safety and oversight
Every control is **enforced in code**, not only written in the prompt.
| Control | How |
|---|---|
| Read-only by default | Write tools are kept apart; the model can only *propose* an action |
| Human approval | Every money move creates a pending action; the code runs it only after an explicit approve |
| Limits | Only transfers between the company's own accounts; no new payees; amount ≤ reserve size |
| Dry run first | The approval card shows the balances before and after |
| Audit log | Every tool call: time, tool, inputs, result summary, who approved |
| Sources on every number | Each figure links to the Seapoint record or rule it came from |
| Honest estimates | R&D credit marked "estimate, confirm with an accountant" and left out of the hiring decision |
| No double moves | Idempotency key on each action, so approving twice moves the money once |
| Sandbox only | Mock or sandbox data; no real bank connection |

### Real finance task
Hiring is the biggest cash decision an early-stage startup makes, and today a fractional CFO does this analysis by hand in a spreadsheet. It covers two of the event's examples: the **board pack** (runway slide) and **treasury / payment run** (reserve move, bills check).

### Technical execution
- Python core engine, unit tested (8 tests passing)
- Claude API tool-use agent loop, with Seapoint tools behind an adapter (mock now, real MCP on the night)
- Approval gate and audit log in code
- Small web UI: chat, before/after runway chart, approval card, audit log panel

### UX clarity
One screen: the question box at the top, the answer with the runway chart, then the approval card, with the audit log on the side. There's one clear decision for the founder: **Approve** or **Reject**.

## 4. Audit against the brief
| Criterion | Status now | After the build | Risk |
|---|---|---|---|
| Technical execution | Engine + tests ✅ | Agent + UI | Seapoint tool names unknown, so the adapter absorbs the change |
| Product thinking | Clear user, problem and wedge ✅ | — | Low |
| Agent autonomy | ❌ calculation only | Plans, checks risks, produces work, acts | Must show multiple tool calls the agent chose itself |
| UX clarity | Old payroll page | One-screen demo | Medium: keep it simple |
| Real-world applicability | UK rules + R&D timing ✅ | — | Rates must be correct; checked in tests |
| Safety and oversight | Planned | Enforced in code | Sandbox may not allow writes, so fall back to a signed instruction |

## 5. Demo script (2–3 minutes)
**0:00. Problem.** "Every founder asks the same question: can we afford to hire? Today that means a weekend in a spreadsheet or a £300 hour with a fractional CFO."

**0:20. Ask.** Type: *"What if I hire 2 engineers at £70k in March?"*

**0:30. The agent works.** The audit log shows its calls: balances, burn, bills, invoices. "It decided what it needed."

**0:50. The answer.**
- "Each engineer really costs £81k with employer NI and pension."
- "Runway drops from 17 to 15 months, still above your 12-month minimum."
- "R&D credit cuts the real cost to about £70k, but HMRC pays it after cash would run out, so I've left it out of the decision."
- "Brightside Health owes you £12.5k overdue, so I drafted a reminder."

**1:40. Oversight.** The approval card reads: "Move £40,535 (3 months of payroll for the 2 new hires) from Main account into the Payroll reserve pot." Show the before and after, then click **Approve**. The audit log records who approved and when.

**2:10. Deliverable.** Show the board-pack runway slide the agent generated.

**2:30. Close.** "WhatIfHire does a fractional CFO's hiring analysis in 30 seconds, and it never moves money without you."

## 6. Build order (small chunks, each verified)
1. ✅ Engine: hire cost, runway, R&D credit
2. ✅ Agent loop + tools + approval gate + audit log (CLI)
3. Board slide and invoice reminder outputs
4. One-screen web UI
5. Swap the mock for the Seapoint MCP (on the night)
6. Rehearse the demo; record a backup video in case the live demo fails
