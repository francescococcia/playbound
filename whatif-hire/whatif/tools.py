"""Tools the agent may call. Read tools hit Seapoint; the only write is a proposal."""
from datetime import date

from . import seapoint_mock as seapoint
from .actions import ActionStore
from .hirecost import uk_hire_cost
from .runway import Hire, compare, earliest_safe_start

MIN_RUNWAY = 12


def _obj(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or list(props),
            "additionalProperties": False}


_HIRE = {
    "role": {"type": "string", "description": "Job title, e.g. 'engineer'"},
    "count": {"type": "integer", "description": "Number of people"},
    "salary": {"type": "number", "description": "Gross annual salary per person, GBP"},
    "start_month": {"type": "string", "description": "First payroll month, YYYY-MM"},
    "rd_share": {"type": "number", "description": "Share of time on qualifying R&D, 0-1. Use 0.8 for engineers unless told otherwise, 0 for non-technical roles."},
}

TOOLS = [
    {"name": "get_balances", "description": "Seapoint: current balance of every company account.", "input_schema": _obj({})},
    {"name": "get_monthly_cashflow", "description": "Seapoint: cash in, cash out and net burn for each of the last 6 months.", "input_schema": _obj({})},
    {"name": "get_burn_runway", "description": "Seapoint: total cash, average net burn (last 3 months) and runway.", "input_schema": _obj({})},
    {"name": "list_bills", "description": "Seapoint: upcoming bills with vendor, amount, due date and status.", "input_schema": _obj({})},
    {"name": "list_invoices", "description": "Seapoint: customer invoices with amount, due date and status (sent, overdue).", "input_schema": _obj({})},
    {"name": "list_treasury_pots", "description": "Seapoint: treasury pots and their balances.", "input_schema": _obj({})},
    {"name": "simulate_hires", "description": "Fully loaded UK cost of the hires and runway before/after, plus R&D credit estimate and when it is actually paid. The only source for cost and runway numbers.", "input_schema": _obj(_HIRE)},
    {"name": "find_safe_start", "description": "Earliest start month at or after start_month that keeps runway at or above the 12-month minimum (R&D credit excluded).", "input_schema": _obj(_HIRE)},
    {"name": "propose_reserve_move", "description": "Propose moving 3 months of the new hires' payroll from the main account into the payroll reserve pot. Creates a PENDING action only; a human must approve it. The amount is computed by the system.", "input_schema": _obj({k: _HIRE[k] for k in ("role", "count", "salary")})},
    {"name": "draft_invoice_reminder", "description": "Draft (not send) a polite payment reminder for an overdue invoice.", "input_schema": _obj({"invoice_id": {"type": "string"}})},
]
for t in TOOLS:
    t["strict"] = True


def _hire(i: dict) -> Hire:
    y, m = (int(x) for x in i["start_month"].split("-"))
    return Hire(i["role"], float(i["salary"]), date(y, m, 1), int(i["count"]), float(i["rd_share"]))


def _projection_start() -> date:
    t = seapoint.TODAY
    return date(t.year + (t.month == 12), t.month % 12 + 1, 1)


def run_tool(name: str, inp: dict, store: ActionStore) -> dict | list:
    if name == "get_balances":
        return seapoint.get_balances()
    if name == "get_monthly_cashflow":
        return seapoint.get_monthly_cashflow()
    if name == "get_burn_runway":
        return seapoint.get_burn_runway()
    if name == "list_bills":
        return seapoint.list_bills()
    if name == "list_invoices":
        return seapoint.list_invoices()
    if name == "list_treasury_pots":
        return seapoint.list_treasury_pots()
    if name in ("simulate_hires", "find_safe_start"):
        r, h = seapoint.get_burn_runway(), _hire(inp)
        if name == "find_safe_start":
            safe = earliest_safe_start(r["cash"], r["avg_net_burn"], _projection_start(), h, MIN_RUNWAY)
            return {"earliest_safe_start": safe.isoformat()[:7] if safe else None, "min_runway_months": MIN_RUNWAY}
        out = compare(r["cash"], r["avg_net_burn"], _projection_start(), [h], MIN_RUNWAY)
        out.pop("projection")
        out["decision_basis"] = "with_hires_no_rd: R&D credit is excluded because it is paid after year end"
        out["meets_min_runway"] = out["with_hires_no_rd"]["runway_months"] >= MIN_RUNWAY
        out["projection_starts"] = _projection_start().isoformat()[:7]
        return out
    if name == "propose_reserve_move":
        a = store.propose_reserve(inp["role"], int(inp["count"]), float(inp["salary"]))
        return {"ref": a.ref, "status": a.status, "amount": a.amount, "from": a.from_account,
                "to": a.to_pot, "reason": a.reason, "note": "Waiting for human approval. You cannot approve it."}
    if name == "draft_invoice_reminder":
        inv = next((i for i in seapoint.list_invoices() if i["id"] == inp["invoice_id"]), None)
        if not inv:
            raise ValueError(f"no invoice {inp['invoice_id']}")
        return {"status": "draft - not sent", "to": inv["customer"],
                "subject": f"Invoice {inv['id']}: payment reminder",
                "body": (f"Hi {inv['customer']} team,\n\nA quick reminder that invoice {inv['id']} for "
                         f"£{inv['amount']:,.2f} was due on {inv['due']}. Could you let us know when we "
                         "can expect payment?\n\nThanks,\nNorthwind Labs")}
    raise ValueError(f"unknown tool {name}")


__all__ = ["TOOLS", "run_tool", "uk_hire_cost"]
