"""
Mandate lifecycle: create (policy + PayPal hold order) -> buyer approves ->
authorize (hold placed) -> one cart settles via the engine, or revoke.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models.db import EventType, Mandate, MandateStatus
from payment_core.paypal_client import (
    PaymentError, authorize_order, create_hold_order, mode, void_authorization,
)
from policy import trail
from policy.mandate_signing import canonical_mandate_body, sign_mandate, verify_mandate_signature

MANDATE_TTL_HOURS = 24


def mandate_policy(mandate: Mandate) -> dict:
    return {
        "currency": mandate.currency,
        "budget_cents": mandate.hold_cents,
        "max_unit_price_cents": mandate.max_unit_price_cents,
        "max_qty_per_sku": mandate.max_qty_per_sku,
        "allowed_categories": mandate.allowed_categories,
        "excluded_allergens": mandate.hard_constraints.get("excluded_allergens", []),
        "unknown_category_action": "REJECT",
        "purpose": mandate.purpose,
    }


def _body(mandate: Mandate) -> str:
    return canonical_mandate_body(
        mandate_id=mandate.mandate_id, version=mandate.version, principal_id=mandate.principal_id,
        agent_id=mandate.agent_id, instruction_text=mandate.instruction_text,
        policy=mandate_policy(mandate), merchant_allowlist=mandate.merchant_allowlist,
        expiry_iso=mandate.expiry.isoformat(),
    )


def signature_valid(mandate: Mandate) -> bool:
    return verify_mandate_signature(_body(mandate), mandate.signature)


def create_mandate(session: Session, *, principal_id: int, agent_id: str, instruction_text: str,
                   policy: dict, merchant_allowlist: list, public_base_url: str) -> Mandate:
    mandate_id = f"lsh_mnd_{uuid.uuid4().hex[:12]}"
    mandate = Mandate(
        mandate_id=mandate_id, version=1, principal_id=principal_id, agent_id=agent_id,
        status=MandateStatus.pending_approval, instruction_text=instruction_text,
        merchant_allowlist=merchant_allowlist, allowed_categories=policy["allowed_categories"],
        hard_constraints={"excluded_allergens": policy["excluded_allergens"]},
        max_unit_price_cents=policy["max_unit_price_cents"], max_qty_per_sku=policy["max_qty_per_sku"],
        hold_cents=policy["budget_cents"], currency=policy["currency"], purpose=policy["purpose"],
        expiry=datetime.now().replace(microsecond=0) + timedelta(hours=MANDATE_TTL_HOURS),
        signature="",
    )
    mandate.signature = sign_mandate(_body(mandate))
    session.add(mandate)
    session.commit()
    trail.append(session, event_type=EventType.mandate_created, actor="principal", source="Leash",
                 mandate_id=mandate_id, decision="signed", reason_summary=instruction_text[:300],
                 detail={"policy": mandate_policy(mandate), "signature": mandate.signature})

    order = create_hold_order(
        amount_cents=mandate.hold_cents, currency=mandate.currency, reference_id=mandate_id,
        description=f"Leash mandate: {mandate.purpose}",
        return_url=f"{public_base_url}/checkout/return?mandate_id={mandate_id}",
        cancel_url=f"{public_base_url}/checkout/cancel?mandate_id={mandate_id}",
        approve_base_url=public_base_url,
    )
    mandate.paypal_order_id = order["order_id"]
    mandate.approve_url = order["approve_url"]
    session.commit()
    trail.append(session, event_type=EventType.hold_created, actor="mandate_service", source="PayPal",
                 mandate_id=mandate_id, decision="awaiting_buyer_approval",
                 reason_summary=f"AUTHORIZE order {order['order_id']} for ${mandate.hold_cents / 100:.2f}",
                 detail={"order_id": order["order_id"], "mode": mode()})
    return mandate


def authorize_mandate(session: Session, *, mandate: Mandate) -> Mandate:
    """Called once the buyer approved the order: places the hold and activates the mandate."""
    if mandate.status == MandateStatus.active and mandate.authorization_id:
        return mandate
    if mandate.status != MandateStatus.pending_approval:
        raise ValueError(f"mandate is {mandate.status.value}, cannot authorize")
    auth = authorize_order(order_id=mandate.paypal_order_id)
    if auth["amount_cents"] != mandate.hold_cents:
        # Never shop against a hold that isn't exactly the signed budget.
        void_authorization(authorization_id=auth["authorization_id"], request_id=f"void-mismatch-{mandate.mandate_id}")
        raise ValueError("authorized amount does not match the mandate budget; hold voided")
    mandate.authorization_id = auth["authorization_id"]
    mandate.authorization_status = auth["status"]
    mandate.authorization_expires_at = auth.get("expiration_time")
    mandate.status = MandateStatus.active
    session.commit()
    trail.append(session, event_type=EventType.hold_authorized, actor="mandate_service", source="PayPal",
                 mandate_id=mandate.mandate_id, decision=auth["status"],
                 reason_summary=f"hold of ${auth['amount_cents'] / 100:.2f} placed",
                 detail={"authorization_id": auth["authorization_id"],
                         "expiration_time": auth.get("expiration_time")})
    return mandate


def revoke_mandate(session: Session, *, mandate_id: str) -> Mandate:
    mandate = session.query(Mandate).filter_by(mandate_id=mandate_id).first()
    if mandate is None:
        raise ValueError(f"No mandate found with id {mandate_id}")
    if mandate.status in (MandateStatus.revoked, MandateStatus.settled):
        return mandate
    mandate.status = MandateStatus.revoked
    session.commit()
    if mandate.authorization_id and mandate.captured_cents == 0:
        try:
            result = void_authorization(authorization_id=mandate.authorization_id,
                                        request_id=f"void-revoke-{mandate.mandate_id}")
            mandate.authorization_status = result["status"]
            session.commit()
            trail.append(session, event_type=EventType.hold_voided, actor="mandate_service", source="PayPal",
                         mandate_id=mandate_id, decision=result["status"],
                         reason_summary=f"mandate revoked; ${mandate.hold_cents / 100:.2f} hold released")
        except PaymentError as e:
            trail.append(session, event_type=EventType.payment_failed, actor="mandate_service", source="PayPal",
                         mandate_id=mandate_id, decision="void_failed", reason_summary=str(e))
    return mandate
