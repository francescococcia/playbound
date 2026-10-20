import unittest
from datetime import date

from whatif import seapoint_mock as sp
from whatif.hirecost import uk_hire_cost
from whatif.rdcredit import rd_credit
from whatif.runway import Hire, compare, project, runway_months


class HireCost(unittest.TestCase):
    def test_70k_engineer(self):
        c = uk_hire_cost(70_000)
        self.assertEqual(c["employer_ni"], 9_750.00)        # (70,000 - 5,000) * 15%
        self.assertEqual(c["employer_pension"], 1_320.90)   # (50,270 - 6,240) * 3%
        self.assertEqual(c["annual_cost"], 81_070.90)

    def test_below_thresholds(self):
        c = uk_hire_cost(4_000)
        self.assertEqual(c["employer_ni"], 0)
        self.assertEqual(c["employer_pension"], 0)


class Runway(unittest.TestCase):
    def test_baseline_matches_simple_division(self):
        rows = project(120_000, 10_000, date(2026, 11, 1))
        self.assertEqual(runway_months(rows), 12)

    def test_hires_shorten_runway(self):
        r = sp.get_burn_runway()
        out = compare(r["cash"], r["avg_net_burn"], date(2026, 11, 1),
                      [Hire("Engineer", 70_000, date(2027, 3, 1), count=2)])
        self.assertGreater(out["runway_lost_months"], 0)
        self.assertLess(out["with_hires"]["runway_months"], out["baseline"]["runway_months"])


class RDCredit(unittest.TestCase):
    def test_merged_scheme_loss_maker(self):
        c = rd_credit(100_000, 1.0, rd_intensive=False)
        self.assertEqual(c["annual_credit"], 16_200.00)

    def test_eris(self):
        c = rd_credit(100_000, 1.0, rd_intensive=True)
        self.assertEqual(c["annual_credit"], 26_970.00)

    def test_credit_lands_after_year_end(self):
        # Hire from Jan 2027, year end March -> Jan-Mar credit lands Sep 2027.
        rows = project(1_000_000, 0, date(2026, 11, 1),
                       [Hire("Eng", 60_000, date(2027, 1, 1), rd_share=1.0)])
        paid = {r["month"]: r["rd_credit_in"] for r in rows if r["rd_credit_in"]}
        self.assertEqual(list(paid)[0], "2027-09")
        monthly = uk_hire_cost(60_000)["monthly_cost"]
        self.assertAlmostEqual(paid["2027-09"], 3 * monthly * 0.162, places=1)


class Mock(unittest.TestCase):
    def test_runway_from_seed(self):
        r = sp.get_burn_runway()
        self.assertEqual(r["cash"], 1_142_000)
        self.assertAlmostEqual(r["avg_net_burn"], 66_066.67, places=2)


if __name__ == "__main__":
    unittest.main()
