"""Month-by-month cash projection with and without planned hires."""
from dataclasses import dataclass
from datetime import date

from .hirecost import uk_hire_cost
from .rdcredit import PAYOUT_LAG_MONTHS, credit_rate, rd_credit


@dataclass
class Hire:
    role: str
    salary: float
    start: date  # first month on payroll
    count: int = 1
    rd_share: float = 0.0  # share of time on qualifying R&D


def _add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    return date(d.year + y, m + 1, 1)


def project(cash: float, net_burn: float, start: date, hires: list[Hire] = (),
            months: int = 36, rd_intensive: bool = False, year_end_month: int = 3,
            include_rd: bool = True) -> list[dict]:
    """Closing cash for each month from `start`, burn held flat plus hire costs.

    R&D credit accrues on each month's qualifying cost and lands as one
    receipt PAYOUT_LAG_MONTHS after the financial year end it belongs to.
    """
    rows, balance, accrued, due = [], cash, 0.0, {}
    rate = credit_rate(rd_intensive)
    first = date(start.year, start.month, 1)
    for i in range(months):
        month = _add_months(first, i)
        active = [h for h in hires if (h.start.year, h.start.month) <= (month.year, month.month)]
        extra = sum(uk_hire_cost(h.salary)["monthly_cost"] * h.count for h in active)
        accrued += sum(uk_hire_cost(h.salary)["monthly_cost"] * h.count * h.rd_share * rate for h in active)
        if month.month == year_end_month and accrued:
            key = _add_months(month, PAYOUT_LAG_MONTHS).isoformat()[:7]
            due[key] = due.get(key, 0.0) + accrued
            accrued = 0.0
        credit = due.pop(month.isoformat()[:7], 0.0) if include_rd else 0.0
        balance += credit - net_burn - extra
        rows.append({"month": month.isoformat()[:7], "burn": round(net_burn + extra, 2),
                     "rd_credit_in": round(credit, 2), "closing_cash": round(balance, 2)})
    return rows


def runout_month(rows: list[dict]) -> str | None:
    """First month that closes below zero, or None within the horizon."""
    return next((r["month"] for r in rows if r["closing_cash"] < 0), None)


def runway_months(rows: list[dict]) -> int:
    """Whole months before cash goes negative."""
    return next((i for i, r in enumerate(rows) if r["closing_cash"] < 0), len(rows))


def compare(cash: float, net_burn: float, start: date, hires: list[Hire],
            min_runway: int = 12, rd_intensive: bool = False, year_end_month: int = 3) -> dict:
    base = project(cash, net_burn, start)
    plan = project(cash, net_burn, start, hires, rd_intensive=rd_intensive,
                   year_end_month=year_end_month)
    no_rd = project(cash, net_burn, start, hires, include_rd=False)
    rm = runway_months(plan)
    received = [r for r in plan[:rm] if r["rd_credit_in"]]
    return {
        "baseline": {"runway_months": runway_months(base), "runout": runout_month(base)},
        "with_hires": {"runway_months": rm, "runout": runout_month(plan)},
        "with_hires_no_rd": {"runway_months": runway_months(no_rd), "runout": runout_month(no_rd)},
        "rd_credits_before_runout": [{"month": r["month"], "amount": r["rd_credit_in"]} for r in received],
        "rd_estimates": [{"role": h.role, "count": h.count,
                          **rd_credit(uk_hire_cost(h.salary)["annual_cost"], h.rd_share, rd_intensive)}
                         for h in hires if h.rd_share],
        "runway_lost_months": runway_months(base) - rm,
        "meets_min_runway": rm >= min_runway,
        "min_runway": min_runway,
        "hire_costs": [{"role": h.role, "count": h.count, **uk_hire_cost(h.salary)} for h in hires],
        "projection": plan,
    }


def earliest_safe_start(cash: float, net_burn: float, start: date, hire: Hire,
                        min_runway: int = 12, horizon: int = 30) -> date | None:
    """First start month from hire.start that keeps runway >= min_runway.

    Ignores R&D credit: it is paid too late to count on.
    """
    for i in range(horizon):
        candidate = _add_months(date(hire.start.year, hire.start.month, 1), i)
        trial = Hire(hire.role, hire.salary, candidate, hire.count, hire.rd_share)
        if runway_months(project(cash, net_burn, start, [trial], include_rd=False)) >= min_runway:
            return candidate
    return None
