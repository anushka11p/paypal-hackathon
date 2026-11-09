from __future__ import annotations

import pytest

from models.db import AuditLog, EventType
from policy import trail
from policy.compiler import CompiledPolicy, PolicyValidationError, normalize, policy_from_fields


def test_trail_chain_verifies_and_detects_tampering(session):
    for i in range(3):
        trail.append(session, event_type=EventType.policy_check, actor="policy_engine", source="Leash",
                     mandate_id="m", decision="passed", reason_summary=f"event {i}")
    assert trail.verify(session)["ok"] is True

    row = session.query(AuditLog).order_by(AuditLog.id).all()[1]
    row.decision = "blocked"   # someone rewrites history
    session.commit()
    result = trail.verify(session)
    assert result["ok"] is False
    assert result["first_bad_id"] == row.id


def test_compiler_asks_instead_of_guessing_a_budget():
    out = normalize(CompiledPolicy(needs_clarification=False, budget_usd=None, allowed_categories=["pet_food"]))
    assert out["needs_clarification"] is True and out["policy"] is None


def test_compiler_normalizes_to_cents_and_defaults():
    out = normalize(CompiledPolicy(needs_clarification=False, budget_usd=80, max_qty_per_sku=2,
                                   allowed_categories=["pet_food", "pet_treats"], excluded_allergens=["chicken"],
                                   purpose="dog food"))
    policy = out["policy"]
    assert policy["budget_cents"] == 8000
    assert policy["max_unit_price_cents"] == 8000   # no unit cap stated -> capped at budget
    assert policy["max_qty_per_sku"] == 2
    assert policy["unknown_category_action"] == "REJECT"


@pytest.mark.parametrize("kwargs", [
    dict(budget_cents=0),
    dict(budget_cents=10_000_000),
    dict(allowed_categories=["firearms"]),
    dict(allowed_categories=[]),
    dict(excluded_allergens=["kryptonite"]),
    dict(max_qty_per_sku=0),
])
def test_hand_edited_policy_is_validated(kwargs):
    base = dict(budget_cents=8000, max_unit_price_cents=None, max_qty_per_sku=2,
                allowed_categories=["pet_food"], excluded_allergens=[], purpose="x")
    with pytest.raises(PolicyValidationError):
        policy_from_fields(**{**base, **kwargs})
