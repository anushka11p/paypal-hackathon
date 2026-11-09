"""
The policy engine: the only thing that can say yes to money moving.

decide()  — pure: deterministic checks + evaluator veto + hold budget.
settle()  — the ONLY place a capture or settlement void happens.

Invariants (each has a test):
1. Deterministic checks read only structured, merchant-verified fields.
2. Any layer can say no; no layer can say yes on its own.
3. capture <= hold - already captured, enforced here before PayPal is
   called (PayPal itself would allow over-capture up to 115% / +$75).
"""
from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.catalog import product_view
from models.db import (
    CartLine, CartProposal, CartStatus, Decision, EventType, Mandate, MandateStatus, Product,
)
from payment_core.paypal_client import (
    PaymentError, capture_authorization, get_authorization, void_authorization,
)
from policy import trail
from policy.evaluator import Verdict, evaluate_cart
from policy.mandate_service import signature_valid

SECURITY_RULES = {"hard_constraint_violation", "category_not_allowed", "qty_exceeds_mandate",
                  "unknown_sku", "product_quarantined"}


class CaptureInvariantViolation(RuntimeError):
    pass


@dataclass
class ProposedLine:
    sku: str
    qty: int
    reason: str = ""


@dataclass
class AgentCart:
    lines: list[ProposedLine]
    summary: str = ""
    transcript: list = field(default_factory=list)
    model: str | None = None


@dataclass
class LineDecision:
    position: int
    sku: str
    name: str | None
    qty: int
    unit_price_cents: int
    agent_reason: str
    deterministic_ok: bool
    deterministic_rule: str | None
    evaluator_ok: bool
    evaluator_reason: str
    final_ok: bool = False
    final_reason: str = ""

    @property
    def line_total_cents(self) -> int:
        return self.unit_price_cents * self.qty


def assert_capture_within_hold(amount_cents: int, hold_cents: int, already_captured_cents: int) -> None:
    if amount_cents <= 0:
        raise CaptureInvariantViolation("capture amount must be positive")
    if already_captured_cents + amount_cents > hold_cents:
        raise CaptureInvariantViolation(
            f"capture of {amount_cents} would exceed the remaining hold "
            f"({hold_cents - already_captured_cents} of {hold_cents})"
        )


def check_line(mandate: Mandate, product: Product | None, qty: int) -> tuple[bool, str | None]:
    """Deterministic rules, in order. Reads ONLY structured fields — never text."""
    if product is None or product.merchant_id not in mandate.merchant_allowlist:
        return False, "unknown_sku"
    if product.quarantined:
        return False, "product_quarantined"
    if product.category not in mandate.allowed_categories:
        return False, "category_not_allowed"
    excluded = set(mandate.hard_constraints.get("excluded_allergens", []))
    if excluded & set(product.allergen_tags.get("contains", [])):
        return False, "hard_constraint_violation"
    if not isinstance(qty, int) or qty < 1:
        return False, "invalid_quantity"
    if qty > mandate.max_qty_per_sku:
        return False, "qty_exceeds_mandate"
    if product.price_cents > mandate.max_unit_price_cents:
        return False, "unit_price_exceeds_mandate"
    if product.stock_qty < qty:
        return False, "out_of_stock"
    return True, None


def check_mandate(mandate: Mandate) -> tuple[bool, str | None]:
    if not signature_valid(mandate):
        return False, "mandate_signature_invalid"
    if mandate.status != MandateStatus.active:
        return False, f"mandate_{mandate.status.value}"
    if mandate.expiry < datetime.now():
        return False, "mandate_expired"
    if not mandate.authorization_id or mandate.authorization_status != "CREATED":
        return False, "hold_not_available"
    if mandate.captured_cents != 0:
        return False, "mandate_already_settled"
    return True, None


class PolicyEngine:
    def __init__(self, evaluator=evaluate_cart):
        self.evaluator = evaluator

    def decide(self, session: Session, *, mandate: Mandate, cart: AgentCart,
               shopping_task: str, scenario: str) -> tuple[list[LineDecision], dict]:
        """No side effects on money. Used by settle() and by the trials runner."""
        skus = {line.sku for line in cart.lines}
        products = {p.sku: p for p in session.query(Product).filter(Product.sku.in_(skus)).all()} if skus else {}

        decisions: list[LineDecision] = []
        for i, line in enumerate(cart.lines):
            product = products.get(line.sku)
            ok, rule = check_line(mandate, product, line.qty)
            decisions.append(LineDecision(
                position=i, sku=line.sku, name=product.name if product else None, qty=line.qty,
                unit_price_cents=product.price_cents if product else 0, agent_reason=line.reason,
                deterministic_ok=ok, deterministic_rule=rule, evaluator_ok=False, evaluator_reason="",
            ))

        # The evaluator reviews every line so the audit shows both layers'
        # opinions, but its verdict can only remove lines, never add them.
        views = {sku: product_view(p, scenario) for sku, p in products.items()}
        verdicts, meta = self.evaluator(
            instruction_text=mandate.instruction_text, shopping_task=shopping_task,
            lines=[{"sku": d.sku, "qty": d.qty, "agent_reason": d.agent_reason} for d in decisions],
            products=views,
        )
        for d in decisions:
            v = verdicts.get(d.sku, Verdict(False, "no verdict"))
            d.evaluator_ok, d.evaluator_reason = v.approve, v.reason

        # Lines must pass both layers, then fit inside the hold, in cart order.
        remaining = mandate.hold_cents - mandate.captured_cents
        seen: set[str] = set()
        for d in decisions:
            if d.sku in seen:
                d.final_ok, d.final_reason = False, "duplicate_line"
            elif not d.deterministic_ok:
                d.final_ok, d.final_reason = False, d.deterministic_rule
            elif not d.evaluator_ok:
                d.final_ok, d.final_reason = False, "evaluator_veto"
            elif d.line_total_cents > remaining:
                d.final_ok, d.final_reason = False, "exceeds_remaining_hold"
            else:
                d.final_ok, d.final_reason = True, "approved"
                remaining -= d.line_total_cents
            seen.add(d.sku)
        return decisions, meta

    def settle(self, session: Session, *, mandate: Mandate, cart: AgentCart,
               shopping_task: str, scenario: str, nonce: str | None = None) -> CartProposal:
        nonce = nonce or uuid.uuid4().hex
        idempotency_key = hashlib.sha256(json.dumps({
            "mandate_id": mandate.mandate_id, "nonce": nonce,
            "lines": [[l.sku, l.qty] for l in cart.lines],
        }, sort_keys=True).encode()).hexdigest()
        existing = session.query(CartProposal).filter_by(idempotency_key=idempotency_key).first()
        if existing:
            return existing

        proposal = CartProposal(
            mandate_id=mandate.mandate_id, nonce=nonce, idempotency_key=idempotency_key,
            scenario=scenario, status=CartStatus.proposed, agent_model=cart.model,
            agent_summary=cart.summary, agent_transcript=cart.transcript,
        )
        session.add(proposal)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            return session.query(CartProposal).filter_by(idempotency_key=idempotency_key).first()

        mid, cid = mandate.mandate_id, proposal.id
        for line in cart.lines:
            trail.append(session, event_type=EventType.agent_proposal, actor="shopping_agent", source="AI Agent",
                         mandate_id=mid, cart_id=cid, decision="proposed",
                         reason_summary=f"{line.qty}x {line.sku}: {line.reason}"[:500],
                         detail={"sku": line.sku, "qty": line.qty})

        ok, reason = check_mandate(mandate)
        if not ok:
            proposal.status = CartStatus.denied
            session.commit()
            trail.append(session, event_type=EventType.policy_denial, actor="policy_engine", source="Leash",
                         mandate_id=mid, cart_id=cid, decision="denied", rule_fired=reason,
                         reason_summary="mandate not usable; nothing evaluated or charged")
            return proposal

        decisions, meta = self.decide(session, mandate=mandate, cart=cart,
                                      shopping_task=shopping_task, scenario=scenario)
        for d in decisions:
            session.add(CartLine(
                cart_id=cid, position=d.position, sku=d.sku, name=d.name, qty=d.qty,
                unit_price_cents=d.unit_price_cents, line_total_cents=d.line_total_cents,
                agent_reason=d.agent_reason,
                deterministic_decision=Decision.approved if d.deterministic_ok else Decision.rejected,
                deterministic_rule=d.deterministic_rule,
                evaluator_decision=Decision.approved if d.evaluator_ok else Decision.rejected,
                evaluator_reason=d.evaluator_reason,
                final_decision=Decision.approved if d.final_ok else Decision.rejected,
                final_reason=d.final_reason,
            ))
            trail.append(
                session,
                event_type=EventType.policy_check if d.deterministic_ok else (
                    EventType.security_event if d.deterministic_rule in SECURITY_RULES else EventType.policy_denial),
                actor="policy_engine", source="Leash", mandate_id=mid, cart_id=cid,
                decision="passed" if d.deterministic_ok else "blocked", rule_fired=d.deterministic_rule,
                reason_summary=f"{d.qty}x {d.sku} — deterministic rules "
                               f"{'passed' if d.deterministic_ok else 'blocked: ' + str(d.deterministic_rule)}",
                detail={"sku": d.sku, "layer": "deterministic"},
            )
            trail.append(
                session, event_type=EventType.evaluator_verdict, actor="intent_evaluator", source="LLM Evaluator",
                mandate_id=mid, cart_id=cid, decision="consistent" if d.evaluator_ok else "veto",
                rule_fired=None if d.evaluator_ok else "evaluator_veto",
                reason_summary=f"{d.sku}: {d.evaluator_reason}"[:500],
                detail={"sku": d.sku, "layer": "evaluator",
                        "injection_suspected": meta.get("injection_suspected", False)},
            )

        proposal.proposed_total_cents = sum(d.line_total_cents for d in decisions)
        proposal.approved_total_cents = sum(d.line_total_cents for d in decisions if d.final_ok)
        session.commit()
        return self._settle_money(session, mandate=mandate, proposal=proposal)

    def _settle_money(self, session: Session, *, mandate: Mandate, proposal: CartProposal) -> CartProposal:
        mid, cid = mandate.mandate_id, proposal.id
        amount = proposal.approved_total_cents
        try:
            live = get_authorization(authorization_id=mandate.authorization_id)
            if live["status"] != "CREATED" or live["amount_cents"] != mandate.hold_cents:
                raise PaymentError(409, "HOLD_STATE_CHANGED",
                                   f"hold is {live['status']} for {live['amount_cents']} cents")
            if amount == 0:
                result = void_authorization(authorization_id=mandate.authorization_id,
                                            request_id=f"void-{proposal.idempotency_key}")
                proposal.status = CartStatus.blocked
                proposal.released_cents = mandate.hold_cents
                mandate.authorization_status = result["status"]
                mandate.status = MandateStatus.settled
                session.commit()
                trail.append(session, event_type=EventType.hold_voided, actor="policy_engine", source="PayPal",
                             mandate_id=mid, cart_id=cid, decision=result["status"],
                             reason_summary=f"nothing passed; full ${mandate.hold_cents / 100:.2f} hold released")
                return proposal

            assert_capture_within_hold(amount, mandate.hold_cents, mandate.captured_cents)
            capture = capture_authorization(
                authorization_id=mandate.authorization_id, amount_cents=amount, currency=mandate.currency,
                final_capture=True, request_id=proposal.idempotency_key, invoice_id=f"{mid}-{cid}",
            )
            after = get_authorization(authorization_id=mandate.authorization_id)
        except PaymentError as e:
            proposal.status = CartStatus.failed
            session.commit()
            trail.append(session, event_type=EventType.payment_failed, actor="policy_engine", source="PayPal",
                         mandate_id=mid, cart_id=cid, decision="failed", rule_fired=e.issue,
                         reason_summary=str(e)[:500])
            return proposal

        proposal.capture_id = capture["capture_id"]
        proposal.capture_status = capture["status"]
        proposal.captured_cents = amount
        proposal.released_cents = mandate.hold_cents - amount
        proposal.authorization_status_after = after["status"]
        proposal.status = CartStatus.captured
        mandate.captured_cents += amount
        mandate.authorization_status = after["status"]
        mandate.status = MandateStatus.settled
        session.commit()
        trail.append(session, event_type=EventType.capture_completed, actor="policy_engine", source="PayPal",
                     mandate_id=mid, cart_id=cid, decision=capture["status"],
                     reason_summary=f"captured ${amount / 100:.2f} of ${mandate.hold_cents / 100:.2f} hold",
                     detail={"capture_id": capture["capture_id"], "final_capture": True})
        trail.append(session, event_type=EventType.hold_released, actor="policy_engine", source="PayPal",
                     mandate_id=mid, cart_id=cid, decision=after["status"],
                     reason_summary=f"${proposal.released_cents / 100:.2f} released "
                                    f"(authorization now {after['status']})")
        return proposal
