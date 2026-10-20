"""The WhatIfHire agent: a Claude tool-use loop over Seapoint data.

The model decides which tools to call. Code enforces what it may do:
read tools run freely, money moves are proposals that wait for a human.
"""
import json
import os

import anthropic

from . import seapoint_mock as seapoint
from .actions import ActionStore
from .audit import AuditLog
from .tools import TOOLS, run_tool

MODEL = os.environ.get("WHATIF_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("WHATIF_EFFORT", "medium")
MAX_TURNS = 15

SYSTEM = f"""You are WhatIfHire, the hiring-and-runway analyst for {seapoint.COMPANY}, a UK startup. Today is {seapoint.TODAY:%d %B %Y}.
A founder asks what-if questions about hiring. Answer like a careful fractional CFO.

How to work:
- Get every figure from the tools. Never estimate a number yourself. Cost and runway come from simulate_hires.
- Look at cash, burn, upcoming bills and invoices before you answer.
- Decide on runway WITHOUT the R&D credit (with_hires_no_rd). HMRC pays it months after the financial year ends; mention it as upside to confirm with an accountant.
- If runway with the hires is under 12 months, call find_safe_start and recommend that month instead.
- If the hire is affordable, call propose_reserve_move. You cannot approve or move money; say that it waits for the founder.
- If an invoice is overdue, call draft_invoice_reminder. It is only a draft.

Reply in this order, short and plain:
1. Verdict in one sentence (yes / yes but tight / not yet, earliest safe start).
2. Key numbers: real cost per person, runway today vs with hires, cash-out month.
3. I also noticed: other risks or opportunities you found.
4. Board slide: a title and 3 bullets for the board pack.
5. Waiting for your approval: the pending action ref and amount, or "nothing"."""


def _summary(result) -> str:
    text = json.dumps(result, default=str)
    return text if len(text) <= 300 else text[:297] + "..."


def run(question: str, store: ActionStore, audit: AuditLog, client=None, on_step=None) -> str:
    client = client or anthropic.Anthropic()
    messages = [{"role": "user", "content": question}]
    audit.record("human", "asked", question=question)
    for _ in range(MAX_TURNS):
        response = client.beta.messages.create(
            model=MODEL, max_tokens=16000, system=SYSTEM, tools=TOOLS, messages=messages,
            thinking={"type": "adaptive"}, output_config={"effort": EFFORT},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        )
        if response.stop_reason == "refusal":
            audit.record("system", "refused")
            return "The model declined this request."
        messages.append({"role": "assistant", "content": response.content})
        calls = [b for b in response.content if b.type == "tool_use"]
        if response.stop_reason != "tool_use" or not calls:
            answer = "\n".join(b.text for b in response.content if b.type == "text")
            audit.record("agent", "answered", chars=len(answer))
            return answer
        results = []
        for call in calls:
            try:
                out, is_error = run_tool(call.name, call.input, store), False
            except Exception as e:  # report the failure to the model, never crash the run
                out, is_error = {"error": str(e)}, True
            entry = audit.record("agent", "tool_call", tool=call.name, input=call.input,
                                 result=_summary(out), error=is_error)
            if on_step:
                on_step(entry)
            results.append({"type": "tool_result", "tool_use_id": call.id,
                            "content": json.dumps(out, default=str), "is_error": is_error})
        messages.append({"role": "user", "content": results})
    audit.record("system", "stopped", reason="turn limit")
    return "Stopped after too many steps. Check the audit log."
