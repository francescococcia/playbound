"""Append-only audit log: one JSON line per agent step or human decision."""
import json
from datetime import datetime, timezone
from pathlib import Path


class AuditLog:
    def __init__(self, path: str | Path | None = "audit.jsonl"):
        self.path = Path(path) if path else None
        self.entries: list[dict] = []

    def record(self, actor: str, event: str, **data) -> dict:
        entry = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                 "actor": actor, "event": event, **data}
        self.entries.append(entry)
        if self.path:
            with self.path.open("a") as f:
                f.write(json.dumps(entry, default=str) + "\n")
        return entry
