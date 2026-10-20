"""Stand-in for the Seapoint MCP, with seeded sandbox-style data.

Each function mirrors one capability the event lists (balances, transactions,
burn & runway, bills, invoices, treasury). On the night, swap this module for
real MCP calls with the same return shapes.
"""
from datetime import date

TODAY = date(2026, 10, 20)
COMPANY = "Northwind Labs Ltd"

_ACCOUNTS = [
    {"id": "acc_main", "name": "Main account", "currency": "GBP", "balance": 842_000.00},
    {"id": "acc_treasury", "name": "Treasury reserve", "currency": "GBP", "balance": 300_000.00},
]

# Net monthly figures for the last 6 months (cash in, cash out).
_MONTHS = [
    ("2026-04", 38_000, 101_000),
    ("2026-05", 41_500, 104_200),
    ("2026-06", 40_200, 108_900),
    ("2026-07", 46_800, 112_300),
    ("2026-08", 44_100, 110_700),
    ("2026-09", 49_300, 115_400),
]

_BILLS = [
    {"id": "bill_101", "vendor": "AWS", "amount": 9_840.00, "due": "2026-10-28", "status": "approved"},
    {"id": "bill_102", "vendor": "WeWork", "amount": 7_200.00, "due": "2026-11-01", "status": "approved"},
    {"id": "bill_103", "vendor": "Deel (contractors)", "amount": 14_500.00, "due": "2026-10-31", "status": "pending"},
    {"id": "bill_104", "vendor": "Legal - Taylor & Co", "amount": 4_250.00, "due": "2026-11-12", "status": "pending"},
]

_INVOICES = [
    {"id": "inv_2041", "customer": "Acme Retail", "amount": 18_000.00, "due": "2026-10-30", "status": "sent"},
    {"id": "inv_2042", "customer": "Brightside Health", "amount": 12_500.00, "due": "2026-11-15", "status": "overdue"},
]

_POTS = [
    {"id": "pot_payroll", "name": "Payroll reserve", "balance": 0.00},
    {"id": "pot_tax", "name": "PAYE / VAT", "balance": 0.00},
]


def get_balances() -> list[dict]:
    return [dict(a) for a in _ACCOUNTS]


def get_monthly_cashflow() -> list[dict]:
    return [{"month": m, "cash_in": i, "cash_out": o, "net_burn": o - i} for m, i, o in _MONTHS]


def get_burn_runway(months: int = 3) -> dict:
    flows = get_monthly_cashflow()[-months:]
    burn = sum(f["net_burn"] for f in flows) / len(flows)
    cash = sum(a["balance"] for a in _ACCOUNTS) + sum(p["balance"] for p in _POTS)
    return {
        "cash": cash,
        "avg_net_burn": round(burn, 2),
        "runway_months": round(cash / burn, 1),
        "basis": f"average net burn over last {months} months",
    }


def list_bills(status: str | None = None) -> list[dict]:
    return [dict(b) for b in _BILLS if status is None or b["status"] == status]


def list_invoices(status: str | None = None) -> list[dict]:
    return [dict(i) for i in _INVOICES if status is None or i["status"] == status]


def list_treasury_pots() -> list[dict]:
    return [dict(p) for p in _POTS]


def move_to_pot(from_account: str, pot_id: str, amount: float) -> dict:
    """WRITE. Internal transfer between the company's own account and pot."""
    acc = next(a for a in _ACCOUNTS if a["id"] == from_account)
    pot = next(p for p in _POTS if p["id"] == pot_id)
    if amount <= 0 or amount > acc["balance"]:
        raise ValueError("amount must be positive and covered by the account balance")
    acc["balance"] = round(acc["balance"] - amount, 2)
    pot["balance"] = round(pot["balance"] + amount, 2)
    return {"from": dict(acc), "to": dict(pot), "amount": amount}


_SEED = None


def reset() -> None:
    """Restore the seeded sandbox state (tests and demo restarts)."""
    global _SEED
    import copy
    if _SEED is None:
        _SEED = copy.deepcopy((_ACCOUNTS, _POTS))
    else:
        _ACCOUNTS[:], _POTS[:] = copy.deepcopy(_SEED)


reset()
