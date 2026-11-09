"""
Tamper-evident authorization trail: every audit row stores the hash of
the previous row, so editing or deleting any past entry breaks the chain.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models.db import AuditLog, EventType

GENESIS = "0" * 64


def _canonical(row: AuditLog) -> str:
    body = {
        "mandate_id": row.mandate_id, "cart_id": row.cart_id,
        "event_type": row.event_type.value if isinstance(row.event_type, EventType) else row.event_type,
        "actor": row.actor, "source": row.source, "decision": row.decision,
        "rule_fired": row.rule_fired, "reason_summary": row.reason_summary,
        "detail": row.detail or {}, "timestamp": row.timestamp.isoformat(),
    }
    return json.dumps(body, sort_keys=True, default=str)


def _hash(prev_hash: str, row: AuditLog) -> str:
    return hashlib.sha256((prev_hash + _canonical(row)).encode()).hexdigest()


def append(session: Session, *, event_type: EventType, actor: str, source: str,
           mandate_id: str | None = None, cart_id: int | None = None, decision: str | None = None,
           rule_fired: str | None = None, reason_summary: str | None = None,
           detail: dict | None = None) -> AuditLog:
    last = session.query(AuditLog).order_by(AuditLog.id.desc()).first()
    prev_hash = last.entry_hash if last else GENESIS
    row = AuditLog(
        mandate_id=mandate_id, cart_id=cart_id, event_type=event_type, actor=actor, source=source,
        decision=decision, rule_fired=rule_fired, reason_summary=reason_summary, detail=detail or {},
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None), prev_hash=prev_hash,
    )
    row.entry_hash = _hash(prev_hash, row)
    session.add(row)
    session.commit()
    return row


def verify(session: Session) -> dict:
    prev = GENESIS
    rows = session.query(AuditLog).order_by(AuditLog.id.asc()).all()
    for row in rows:
        if row.prev_hash != prev or row.entry_hash != _hash(prev, row):
            return {"ok": False, "checked": len(rows), "first_bad_id": row.id}
        prev = row.entry_hash
    return {"ok": True, "checked": len(rows), "first_bad_id": None, "head": prev}
