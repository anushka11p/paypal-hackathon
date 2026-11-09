"""
Runs the real sandbox code path against a fake PayPal REST server
(httpx.MockTransport) to check the exact requests Leash sends.
"""
from __future__ import annotations

import json

import httpx
import pytest

from models.db import CartStatus
from payment_core import paypal_client
from policy.engine import AgentCart, PolicyEngine, ProposedLine
from tests.conftest import ATTACK_CART, fake_evaluator, make_mandate


class FakePayPal:
    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.auth_status = "CREATED"

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if path == "/v1/oauth2/token":
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 3600})
        if path == "/v2/checkout/orders":
            return httpx.Response(201, json={"id": "ORDER1", "status": "PAYER_ACTION_REQUIRED", "links": [
                {"rel": "payer-action", "href": "https://sandbox.example/checkoutnow?token=ORDER1"}]})
        if path == "/v2/checkout/orders/ORDER1/authorize":
            return httpx.Response(201, json={"id": "ORDER1", "status": "COMPLETED", "purchase_units": [{
                "payments": {"authorizations": [{"id": "AUTH1", "status": "CREATED",
                                                 "amount": {"currency_code": "USD", "value": "80.00"},
                                                 "expiration_time": "2026-12-08T00:00:00Z"}]}}]})
        if path == "/v2/payments/authorizations/AUTH1" and request.method == "GET":
            return httpx.Response(200, json={"id": "AUTH1", "status": self.auth_status,
                                             "amount": {"currency_code": "USD", "value": "80.00"}})
        if path == "/v2/payments/authorizations/AUTH1/capture":
            body = json.loads(request.content)
            self.auth_status = "CAPTURED"
            return httpx.Response(201, json={"id": "CAP1", "status": "COMPLETED", "amount": body["amount"]})
        if path == "/v2/payments/authorizations/AUTH1/void":
            self.auth_status = "VOIDED"
            return httpx.Response(204)
        return httpx.Response(404, json={"name": "RESOURCE_NOT_FOUND", "details": [{"issue": "NOT_FOUND"}]})

    def find(self, path_suffix: str) -> httpx.Request:
        return next(r for r in self.requests if r.url.path.endswith(path_suffix))


@pytest.fixture
def fake_paypal(monkeypatch):
    fake = FakePayPal()
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "client")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "secret")
    monkeypatch.setattr(paypal_client, "_transport", httpx.MockTransport(fake.handler))
    return fake


def test_hold_order_is_authorize_intent_for_exact_budget(session, fake_paypal):
    mandate = make_mandate(session)
    body = json.loads(fake_paypal.find("/v2/checkout/orders").content)
    assert body["intent"] == "AUTHORIZE"
    assert len(body["purchase_units"]) == 1   # AUTHORIZE isn't supported with multiple purchase units
    assert body["purchase_units"][0]["amount"] == {"currency_code": "USD", "value": "80.00"}
    assert mandate.approve_url.startswith("https://sandbox.example/")
    assert mandate.authorization_id == "AUTH1"


def test_partial_capture_request_shape(session, fake_paypal):
    mandate = make_mandate(session)
    agent_cart = AgentCart(lines=[ProposedLine(sku=s, qty=q) for s, q in ATTACK_CART])
    result = PolicyEngine(evaluator=fake_evaluator(veto={"PET-9001"})).settle(
        session, mandate=mandate, cart=agent_cart, shopping_task="restock", scenario="attack")

    capture = fake_paypal.find("/capture")
    body = json.loads(capture.content)
    assert body["amount"] == {"currency_code": "USD", "value": "62.00"}
    assert body["final_capture"] is True
    assert capture.headers["PayPal-Request-Id"] == result.idempotency_key
    assert capture.headers["Authorization"] == "Bearer tok"
    assert result.status == CartStatus.captured
    assert result.authorization_status_after == "CAPTURED"   # read back, not assumed
    gets = [r for r in fake_paypal.requests if r.method == "GET"]
    assert len(gets) == 2   # state checked before and after capture


def test_hold_changed_outside_leash_blocks_capture(session, fake_paypal):
    mandate = make_mandate(session)
    fake_paypal.auth_status = "VOIDED"
    result = PolicyEngine(evaluator=fake_evaluator()).settle(
        session, mandate=mandate, cart=AgentCart(lines=[ProposedLine("PET-1001", 1)]),
        shopping_task="restock", scenario="clean")
    assert result.status == CartStatus.failed
    assert not any(r.url.path.endswith("/capture") for r in fake_paypal.requests)


def test_amount_formatting():
    assert paypal_client.to_value(6200) == "62.00"
    assert paypal_client.to_value(5) == "0.05"
    assert paypal_client.to_cents("80.00") == 8000
    assert paypal_client.to_cents("0.1") == 10
