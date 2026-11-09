from __future__ import annotations

import pytest

from models.db import CartStatus, MandateStatus
from payment_core.mock_paypal import mock
from policy import evaluator as evaluator_module
from policy.engine import (
    AgentCart, CaptureInvariantViolation, PolicyEngine, ProposedLine, assert_capture_within_hold,
)
from policy.evaluator import evaluate_cart
from policy.mandate_service import revoke_mandate
from llm.claude import LLMUnavailable
from tests.conftest import ATTACK_CART, fake_evaluator, make_mandate


def cart(*items):
    return AgentCart(lines=[ProposedLine(sku=s, qty=q, reason="test") for s, q in items])


def settle(session, mandate, agent_cart, evaluator, nonce=None):
    return PolicyEngine(evaluator=evaluator).settle(
        session, mandate=mandate, cart=agent_cart, shopping_task="restock", scenario="attack", nonce=nonce)


def by_sku(proposal):
    return {l.sku: l for l in proposal.lines}


def test_attack_cart_captures_62_and_releases_18(session):
    """The demo: evaluator catches B (add-on), misses A (qty 5). Hard rules still block A."""
    mandate = make_mandate(session)
    result = settle(session, mandate, cart(*ATTACK_CART), fake_evaluator(veto={"PET-9001"}))

    assert result.status == CartStatus.captured
    assert result.proposed_total_cents == 4400 + 4500 + 1800 + 900
    assert result.captured_cents == 6200
    assert result.released_cents == 1800
    lines = by_sku(result)
    assert lines["PET-3010"].final_reason == "qty_exceeds_mandate"
    assert lines["PET-3010"].evaluator_decision.value == "approved"   # evaluator fooled, money still safe
    assert lines["PET-9001"].deterministic_decision.value == "approved"  # fits every hard rule
    assert lines["PET-9001"].final_reason == "evaluator_veto"
    assert mandate.status == MandateStatus.settled
    assert mock.get_authorization(authorization_id=mandate.authorization_id)["status"] == "CAPTURED"


def test_fooled_evaluator_loses_coverage_not_safety(session):
    mandate = make_mandate(session)
    result = settle(session, mandate, cart(*ATTACK_CART), fake_evaluator(veto=set()))
    assert by_sku(result)["PET-3010"].final_reason == "qty_exceeds_mandate"
    assert result.captured_cents == 4400 + 1800 + 900


def test_allergen_and_category_rules_ignore_evaluator_approval(session):
    mandate = make_mandate(session)
    result = settle(session, mandate, cart(("PET-2214", 1), ("PET-4001", 1)), fake_evaluator())
    lines = by_sku(result)
    assert lines["PET-2214"].final_reason == "hard_constraint_violation"
    assert lines["PET-4001"].final_reason == "category_not_allowed"
    assert result.status == CartStatus.blocked


def test_nothing_passes_voids_whole_hold(session):
    mandate = make_mandate(session)
    result = settle(session, mandate, cart(("PET-2214", 1)), fake_evaluator())
    assert result.status == CartStatus.blocked
    assert result.released_cents == 8000
    assert mock.get_authorization(authorization_id=mandate.authorization_id)["status"] == "VOIDED"


def test_lines_beyond_remaining_hold_are_rejected_in_order(session):
    mandate = make_mandate(session)
    result = settle(session, mandate, cart(("PET-1001", 1), ("PET-1030", 2)), fake_evaluator())
    lines = by_sku(result)
    assert lines["PET-1001"].final_reason == "approved"
    assert lines["PET-1030"].final_reason == "exceeds_remaining_hold"  # 4400 + 6200 > 8000
    assert result.captured_cents == 4400


def test_unknown_sku_rejected(session):
    mandate = make_mandate(session)
    result = settle(session, mandate, cart(("PET-1001", 1), ("FAKE-1", 1)), fake_evaluator())
    assert by_sku(result)["FAKE-1"].final_reason == "unknown_sku"


def test_evaluator_outage_fails_closed(session, monkeypatch):
    def boom(**kwargs):
        raise LLMUnavailable("offline")
    monkeypatch.setattr(evaluator_module.claude, "parse", boom)
    mandate = make_mandate(session)
    result = settle(session, mandate, cart(("PET-1001", 1)), evaluate_cart)
    assert by_sku(result)["PET-1001"].final_reason == "evaluator_veto"
    assert result.status == CartStatus.blocked


def test_revoked_mandate_blocks_even_if_agent_doesnt_know(session):
    mandate = make_mandate(session)
    revoke_mandate(session, mandate_id=mandate.mandate_id)
    evaluator = fake_evaluator()
    result = settle(session, mandate, cart(("PET-1001", 1)), evaluator)
    assert result.status == CartStatus.denied
    assert evaluator.calls == []
    assert mock.get_authorization(authorization_id=mandate.authorization_id)["status"] == "VOIDED"


def test_unapproved_hold_cannot_be_spent(session):
    mandate = make_mandate(session, approve=False)
    result = settle(session, mandate, cart(("PET-1001", 1)), fake_evaluator())
    assert result.status == CartStatus.denied


def test_session_settles_only_once(session):
    mandate = make_mandate(session)
    settle(session, mandate, cart(("PET-1001", 1)), fake_evaluator())
    second = settle(session, mandate, cart(("PET-3020", 1)), fake_evaluator())
    assert second.status == CartStatus.denied
    assert mandate.captured_cents == 4400


def test_idempotent_settlement(session):
    mandate = make_mandate(session)
    first = settle(session, mandate, cart(("PET-1001", 1)), fake_evaluator(), nonce="n1")
    again = settle(session, mandate, cart(("PET-1001", 1)), fake_evaluator(), nonce="n1")
    assert first.id == again.id
    assert mandate.captured_cents == 4400


def test_tampered_mandate_is_refused(session):
    mandate = make_mandate(session)
    mandate.max_qty_per_sku = 50   # edited in the database, not re-signed
    session.commit()
    result = settle(session, mandate, cart(("PET-3010", 5)), fake_evaluator())
    assert result.status == CartStatus.denied


def test_capture_invariant_is_ours_not_paypals(session):
    """PayPal-like over-capture is allowed by the processor, so Leash must enforce the hold itself."""
    mandate = make_mandate(session)
    # The processor would accept 115% of an $80 hold...
    assert mock.capture(authorization_id=mandate.authorization_id, amount_cents=9000, currency="USD",
                        final_capture=True, request_id="direct")["status"] == "COMPLETED"
    # ...which is exactly what Leash refuses to do.
    with pytest.raises(CaptureInvariantViolation):
        assert_capture_within_hold(9000, 8000, 0)
    with pytest.raises(CaptureInvariantViolation):
        assert_capture_within_hold(1, 8000, 8000)
    assert_capture_within_hold(8000, 8000, 0)
