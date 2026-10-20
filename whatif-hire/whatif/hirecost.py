"""Fully loaded cost of a UK hire (employer side).

Rates are for tax year 2025/26 -- check them before the demo.
"""

EMPLOYER_NI_RATE = 0.15          # Class 1 secondary
NI_SECONDARY_THRESHOLD = 5_000   # per year
PENSION_EMPLOYER_RATE = 0.03     # auto-enrolment minimum
PENSION_QE_LOWER = 6_240         # qualifying earnings band
PENSION_QE_UPPER = 50_270


def uk_hire_cost(salary: float) -> dict:
    """Annual employer cost of one hire on `salary` (GBP, gross)."""
    ni = max(0.0, salary - NI_SECONDARY_THRESHOLD) * EMPLOYER_NI_RATE
    qualifying = max(0.0, min(salary, PENSION_QE_UPPER) - PENSION_QE_LOWER)
    pension = qualifying * PENSION_EMPLOYER_RATE
    total = salary + ni + pension
    return {
        "salary": round(salary, 2),
        "employer_ni": round(ni, 2),
        "employer_pension": round(pension, 2),
        "annual_cost": round(total, 2),
        "monthly_cost": round(total / 12, 2),
        "uplift_pct": round((total / salary - 1) * 100, 1) if salary else 0.0,
    }
