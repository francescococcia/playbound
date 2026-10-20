"""UK R&D tax credit estimate on a hire's qualifying staff costs.

Rules for accounting periods from 1 April 2024 -- an estimate for planning,
always confirmed by an accountant before it is counted on.
- Merged scheme: 20% taxable credit; net ~16.2% for a loss-maker (19% tax).
- ERIS (R&D-intensive loss-making SME, R&D >= 30% of total spend):
  186% deduction surrendered at 14.5% -> ~26.97% of qualifying cost.
Qualifying staff costs = salary + employer NI + employer pension, times the
share of time spent on R&D.
"""

MERGED_NET_RATE = 0.20 * (1 - 0.19)
ERIS_RATE = 1.86 * 0.145
PAYOUT_LAG_MONTHS = 6  # typical wait after year end: filing plus HMRC processing


def credit_rate(rd_intensive: bool) -> float:
    return ERIS_RATE if rd_intensive else MERGED_NET_RATE


def rd_credit(annual_staff_cost: float, rd_share: float, rd_intensive: bool) -> dict:
    qualifying = annual_staff_cost * rd_share
    rate = credit_rate(rd_intensive)
    return {
        "scheme": "ERIS" if rd_intensive else "Merged scheme",
        "rate_pct": round(rate * 100, 2),
        "qualifying_cost": round(qualifying, 2),
        "annual_credit": round(qualifying * rate, 2),
        "net_annual_cost": round(annual_staff_cost - qualifying * rate, 2),
        "status": "estimate - confirm with an accountant",
    }
