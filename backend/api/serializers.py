from __future__ import annotations

from models.db import AuditLog, CartProposal, Mandate
from policy.mandate_service import mandate_policy


def mandate_out(m: Mandate) -> dict:
    return {
        "mandate_id": m.mandate_id,
        "status": m.status.value,
        "instruction_text": m.instruction_text,
        "policy": mandate_policy(m),
        "hold_cents": m.hold_cents,
        "captured_cents": m.captured_cents,
        "released_cents": m.hold_cents - m.captured_cents if m.status.value in ("settled", "revoked") else 0,
        "currency": m.currency,
        "expiry": m.expiry.isoformat(),
        "created_at": m.created_at.isoformat(),
        "signature": m.signature,
        "paypal": {
            "order_id": m.paypal_order_id,
            "approve_url": m.approve_url,
            "authorization_id": m.authorization_id,
            "authorization_status": m.authorization_status,
            "authorization_expires_at": m.authorization_expires_at,
        },
    }


def cart_out(c: CartProposal) -> dict:
    return {
        "cart_id": c.id,
        "mandate_id": c.mandate_id,
        "scenario": c.scenario,
        "status": c.status.value,
        "proposed_total_cents": c.proposed_total_cents,
        "approved_total_cents": c.approved_total_cents,
        "captured_cents": c.captured_cents,
        "released_cents": c.released_cents,
        "paypal": {"capture_id": c.capture_id, "capture_status": c.capture_status,
                   "authorization_status_after": c.authorization_status_after},
        "agent": {"model": c.agent_model, "summary": c.agent_summary, "transcript": c.agent_transcript},
        "lines": [{
            "sku": l.sku, "name": l.name, "qty": l.qty, "unit_price_cents": l.unit_price_cents,
            "line_total_cents": l.line_total_cents, "agent_reason": l.agent_reason,
            "deterministic": {"decision": l.deterministic_decision.value, "rule": l.deterministic_rule},
            "evaluator": {"decision": l.evaluator_decision.value, "reason": l.evaluator_reason},
            "final": {"decision": l.final_decision.value, "reason": l.final_reason},
        } for l in c.lines],
        "created_at": c.created_at.isoformat(),
    }


def audit_out(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat(),
        "event_type": log.event_type.value,
        "actor": log.actor,
        "source": log.source,
        "decision": log.decision,
        "rule_fired": log.rule_fired,
        "reason_summary": log.reason_summary,
        "detail": log.detail,
        "mandate_id": log.mandate_id,
        "cart_id": log.cart_id,
        "prev_hash": log.prev_hash,
        "entry_hash": log.entry_hash,
    }
