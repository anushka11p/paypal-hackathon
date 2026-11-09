from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import get_db_session
from api.serializers import audit_out
from models.db import AuditLog
from policy import trail

router = APIRouter()


@router.get("/audit")
def get_all_events(limit: int = 500, session: Session = Depends(get_db_session)):
    logs = session.query(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 2000)).all()
    return {"events": [audit_out(log) for log in reversed(logs)]}


@router.get("/audit/verify")
def verify_chain(session: Session = Depends(get_db_session)):
    return trail.verify(session)


@router.get("/audit/{mandate_id}")
def get_audit_trail(mandate_id: str, session: Session = Depends(get_db_session)):
    logs = session.query(AuditLog).filter_by(mandate_id=mandate_id).order_by(AuditLog.id.asc()).all()
    return {"mandate_id": mandate_id, "events": [audit_out(log) for log in logs]}
