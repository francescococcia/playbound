import unittest
from datetime import date
from types import SimpleNamespace as NS

from whatif import seapoint_mock as sp
from whatif.actions import ActionStore
from whatif.agent import run
from whatif.audit import AuditLog
from whatif.runway import Hire, earliest_safe_start


def tool(id, name, inp):
    return NS(type="tool_use", id=id, name=name, input=inp)


def text(t):
    return NS(type="text", text=t)


class FakeClient:
    """Plays back scripted model turns and records each request."""
    def __init__(self, turns):
        self.turns, self.requests = list(turns), []
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.requests.append({**kw, "messages": list(kw["messages"])})
        content = self.turns.pop(0)
        stop = "tool_use" if any(b.type == "tool_use" for b in content) else "end_turn"
        return NS(content=content, stop_reason=stop)


HIRE = {"role": "engineer", "count": 2, "salary": 70000, "start_month": "2027-03", "rd_share": 0.8}


class Guardrails(unittest.TestCase):
    def setUp(self):
        sp.reset()
        self.store = ActionStore(AuditLog(None))

    def test_amount_is_computed_not_chosen(self):
        a = self.store.propose_reserve("engineer", 2, 70000)
        self.assertEqual(a.amount, 40535.46)
        self.assertEqual(a.status, "pending")

    def test_proposal_moves_no_money(self):
        self.store.propose_reserve("engineer", 2, 70000)
        self.assertEqual(sp.get_balances()[0]["balance"], 842000)

    def test_double_approve_moves_once(self):
        a = self.store.propose_reserve("engineer", 2, 70000)
        self.store.approve(a.ref, "founder")
        self.store.approve(a.ref, "founder")
        self.assertEqual(sp.get_balances()[0]["balance"], 842000 - 40535.46)
        self.assertEqual(sp.list_treasury_pots()[0]["balance"], 40535.46)

    def test_same_proposal_twice_is_one_action(self):
        a = self.store.propose_reserve("engineer", 2, 70000)
        b = self.store.propose_reserve("engineer", 2, 70000)
        self.assertIs(a, b)

    def test_rejected_cannot_be_approved(self):
        a = self.store.propose_reserve("engineer", 2, 70000)
        self.store.reject(a.ref, "founder")
        self.store.approve(a.ref, "founder")
        self.assertEqual(sp.get_balances()[0]["balance"], 842000)

    def test_cannot_drain_account(self):
        with self.assertRaises(ValueError):
            self.store.propose_reserve("engineer", 20, 200000)


class SafeStart(unittest.TestCase):
    def test_matches_ui(self):
        r = sp.get_burn_runway()
        safe = earliest_safe_start(r["cash"], r["avg_net_burn"], date(2026, 11, 1),
                                   Hire("eng", 75000, date(2026, 12, 1), 5, 0.8))
        self.assertEqual(safe, date(2027, 2, 1))


class AgentLoop(unittest.TestCase):
    def setUp(self):
        sp.reset()
        self.audit = AuditLog(None)
        self.store = ActionStore(self.audit)

    def test_full_run_proposes_but_never_moves_money(self):
        client = FakeClient([
            [tool("t1", "get_burn_runway", {}), tool("t2", "list_invoices", {}), tool("t3", "list_bills", {})],
            [tool("t4", "simulate_hires", HIRE)],
            [tool("t5", "propose_reserve_move", {"role": "engineer", "count": 2, "salary": 70000}),
             tool("t6", "draft_invoice_reminder", {"invoice_id": "inv_2042"})],
            [text("Yes, you can afford it.")],
        ])
        answer = run("What if I hire 2 engineers at £70k in March?", self.store, self.audit, client=client)
        self.assertEqual(answer, "Yes, you can afford it.")
        calls = [e["tool"] for e in self.audit.entries if e["event"] == "tool_call"]
        self.assertEqual(calls, ["get_burn_runway", "list_invoices", "list_bills", "simulate_hires",
                                 "propose_reserve_move", "draft_invoice_reminder"])
        self.assertEqual(len(self.store.pending()), 1)
        self.assertEqual(sp.get_balances()[0]["balance"], 842000)
        # All tool results from one turn go back in a single user message
        last = client.requests[-1]["messages"]
        self.assertEqual(len(last[-1]["content"]), 2)

    def test_simulation_numbers_reach_the_model(self):
        client = FakeClient([[tool("t1", "simulate_hires", HIRE)], [text("ok")]])
        run("q", self.store, self.audit, client=client)
        result = client.requests[1]["messages"][-1]["content"][0]["content"]
        self.assertIn('"runway_lost_months": 2', result)
        self.assertIn('"meets_min_runway": true', result)

    def test_unknown_tool_is_an_error_result_not_a_crash(self):
        client = FakeClient([[tool("t1", "approve_action", {"ref": "x"})], [text("I can't approve.")]])
        run("approve it yourself", self.store, self.audit, client=client)
        self.assertTrue(self.audit.entries[1]["error"])
        self.assertEqual(sp.get_balances()[0]["balance"], 842000)


if __name__ == "__main__":
    unittest.main()
