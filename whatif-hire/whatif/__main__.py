"""CLI: python -m whatif "What if I hire 2 engineers at £70k in March?"

Approval happens here, typed by a person; the agent has no way to approve.
"""
import sys

from . import seapoint_mock as seapoint
from .actions import ActionStore
from .agent import run
from .audit import AuditLog


def main() -> None:
    question = " ".join(sys.argv[1:]) or input("What if… ")
    audit = AuditLog("audit.jsonl")
    store = ActionStore(audit)
    show = lambda e: print(f"  · {e['tool']:<22} {e['result'][:90]}")
    print("Agent working…")
    print("\n" + run(question, store, audit, on_step=show) + "\n")
    for a in store.pending():
        print(f"PENDING {a.ref}: move £{a.amount:,.2f} {a.from_account} → {a.to_pot} ({a.reason})")
        if input("Approve? type 'approve' to confirm: ").strip().lower() == "approve":
            store.approve(a.ref, approver="founder")
            print("Approved. Balances:", seapoint.get_balances(), seapoint.list_treasury_pots())
        else:
            store.reject(a.ref, approver="founder")
            print("Rejected. No money moved.")
    print("Audit log: audit.jsonl")


if __name__ == "__main__":
    main()
