"""Money-moving actions. The agent can only propose; a human approves.

Every guardrail lives here in code, so no prompt can talk its way past it.
"""
import hashlib
from dataclasses import dataclass, field

from . import seapoint_mock as seapoint
from .audit import AuditLog
from .hirecost import uk_hire_cost

RESERVE_MONTHS = 3
SOURCE_ACCOUNT = "acc_main"
RESERVE_POT = "pot_payroll"
MIN_BALANCE_AFTER_BILLS = 50_000  # main account must still cover bills plus this buffer


@dataclass
class Action:
    ref: str
    kind: str
    amount: float
    from_account: str
    to_pot: str
    reason: str
    status: str = "pending"  # pending -> approved | rejected
    result: dict = field(default_factory=dict)


class ActionStore:
    def __init__(self, audit: AuditLog):
        self.audit = audit
        self.actions: dict[str, Action] = {}

    def propose_reserve(self, role: str, count: int, salary: float) -> Action:
        """Size the payroll reserve from the hire itself; the agent never picks the amount."""
        if not 1 <= count <= 20 or not 10_000 <= salary <= 500_000:
            raise ValueError("count must be 1-20 and salary between 10,000 and 500,000")
        amount = round(uk_hire_cost(salary)["monthly_cost"] * count * RESERVE_MONTHS, 2)
        main = next(a for a in seapoint.get_balances() if a["id"] == SOURCE_ACCOUNT)
        bills = sum(b["amount"] for b in seapoint.list_bills())
        if main["balance"] - amount < bills + MIN_BALANCE_AFTER_BILLS:
            raise ValueError("moving this much would leave too little to pay upcoming bills")
        ref = "act_" + hashlib.sha256(f"{role}|{count}|{salary}|{amount}".encode()).hexdigest()[:8]
        if ref in self.actions:  # same proposal twice -> same action, never a second move
            return self.actions[ref]
        action = Action(ref, "move_to_pot", amount, SOURCE_ACCOUNT, RESERVE_POT,
                        f"{RESERVE_MONTHS} months of payroll for {count} x {role} at {salary:,.0f}")
        self.actions[ref] = action
        self.audit.record("agent", "proposed", ref=ref, amount=amount, reason=action.reason)
        return action

    def approve(self, ref: str, approver: str) -> Action:
        action = self.actions[ref]
        if action.status != "pending":  # idempotent: approving twice moves money once
            return action
        action.result = seapoint.move_to_pot(action.from_account, action.to_pot, action.amount)
        action.status = "approved"
        self.audit.record("human", "approved", ref=ref, approver=approver, amount=action.amount)
        return action

    def reject(self, ref: str, approver: str) -> Action:
        action = self.actions[ref]
        if action.status == "pending":
            action.status = "rejected"
            self.audit.record("human", "rejected", ref=ref, approver=approver)
        return action

    def pending(self) -> list[Action]:
        return [a for a in self.actions.values() if a.status == "pending"]
