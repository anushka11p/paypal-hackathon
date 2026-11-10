from __future__ import annotations

import pytest

from models.db import Merchant, User, UserRole, get_engine, get_session_factory, init_db
from models.seed import demo_products
from payment_core import paypal_client
from payment_core.mock_paypal import mock
from policy.evaluator import Verdict
from policy.mandate_service import authorize_mandate, create_mandate

ATTACK_CART = [("PET-1001", 1), ("PET-3010", 5), ("PET-3020", 1), ("PET-9001", 1)]


@pytest.fixture(autouse=True)
def mock_payments(monkeypatch):
    """Every test runs against the in-memory PayPal unless it opts into the sandbox path."""
    # Empty (not deleted) so load_dotenv() can't pull the real sandbox keys back in.
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "")
    monkeypatch.setattr(paypal_client, "_transport", None)
    paypal_client._token.update({"value": None, "expires_at": 0.0})
    mock.reset()
    yield


@pytest.fixture
def session():
    engine = get_engine("sqlite:///:memory:")
    init_db(engine)
    s = get_session_factory(engine)()
    s.add(User(name="Test Principal", role=UserRole.principal))
    merchant = Merchant(name="Bramble & Co.")
    s.add(merchant)
    s.commit()
    s.add_all(demo_products(merchant.id))
    s.commit()
    yield s
    s.close()


DEMO_POLICY = {
    "currency": "USD", "budget_cents": 8000, "max_unit_price_cents": 8000, "max_qty_per_sku": 2,
    "allowed_categories": ["pet_food", "pet_treats"], "excluded_allergens": ["chicken"],
    "unknown_category_action": "REJECT", "purpose": "dog food and treats",
}


def make_mandate(session, policy: dict | None = None, *, approve: bool = True):
    mandate = create_mandate(
        session, principal_id=1, agent_id="agent_test",
        instruction_text="Dog food and treats, up to $80, max 2 of anything, never chicken.",
        policy=policy or DEMO_POLICY, merchant_allowlist=[1], public_base_url="http://test",
    )
    if approve:
        if not paypal_client.using_sandbox():
            mock.approve(mandate.paypal_order_id)
        authorize_mandate(session, mandate=mandate)
    return mandate


def fake_evaluator(veto: set[str] = frozenset()):
    """Stands in for the LLM evaluator: vetoes exactly the given skus, approves the rest."""
    calls = []

    def evaluate(*, instruction_text, shopping_task, lines, products):
        calls.append(lines)
        return ({l["sku"]: Verdict(l["sku"] not in veto, "vetoed" if l["sku"] in veto else "ok") for l in lines},
                {"injection_suspected": bool(veto), "notes": "fake", "available": True})

    evaluate.calls = calls
    return evaluate
