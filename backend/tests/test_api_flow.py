"""
End-to-end over HTTP with the payment simulator: create mandate -> approve
hold -> agent shops (stubbed) -> engine settles -> audit trail verifies.
"""
from __future__ import annotations

import importlib
import os

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ATTACK_CART, fake_evaluator


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'api.db'}")
    monkeypatch.setenv("PUBLIC_BASE_URL", "http://testserver")
    monkeypatch.setenv("FRONTEND_URL", "http://frontend")
    monkeypatch.delenv("AGENT_SERVICE_URL", raising=False)
    import api.main
    importlib.reload(api.main)
    import api.shop
    monkeypatch.setattr(api.shop, "run_agent", lambda task, catalog, on_event=None: {
        "lines": [{"sku": s, "qty": q, "reason": "stub"} for s, q in ATTACK_CART],
        "summary": "stub cart", "transcript": [{"type": "text", "text": "stub"}], "model": "stub",
    })
    monkeypatch.setattr(api.shop, "PolicyEngine",
                        lambda: __import__("policy.engine", fromlist=["PolicyEngine"]).PolicyEngine(
                            evaluator=fake_evaluator(veto={"PET-9001"})))
    return TestClient(api.main.app)


POLICY = {"budget_cents": 8000, "max_qty_per_sku": 2, "allowed_categories": ["pet_food", "pet_treats"],
          "excluded_allergens": ["chicken"], "purpose": "dog food and treats"}


def test_full_flow(client):
    assert client.get("/health").json()["payments"] == "mock"
    catalog = client.get("/catalog?scenario=attack").json()
    assert any(r.get("simulated_attack") for p in catalog["products"] for r in p["reviews"])
    clean = client.get("/catalog?scenario=clean").json()
    assert not any(r.get("simulated_attack") for p in clean["products"] for r in p["reviews"])

    created = client.post("/mandates", json={"text": "Dog food and treats up to $80", "policy": POLICY}).json()
    mid = created["mandate_id"]
    assert created["status"] == "pending_approval"

    # Shopping before approval is refused.
    assert client.post(f"/mandates/{mid}/shop", json={}).status_code == 409

    order_id = created["paypal"]["order_id"]
    assert client.get(f"/mock-checkout/{order_id}").status_code == 200
    approve = client.post(f"/mock-checkout/{order_id}/approve", follow_redirects=False)
    assert approve.status_code == 303
    returned = client.get(approve.headers["location"].replace("http://testserver", ""), follow_redirects=False)
    assert returned.headers["location"].startswith("http://frontend/?mandate=")
    assert client.get(f"/mandates/{mid}").json()["status"] == "active"

    shop = client.post(f"/mandates/{mid}/shop?wait=true", json={"scenario": "attack"}).json()
    assert shop["state"] == "done", shop.get("error")
    assert client.get(f"/mandates/{mid}/shop-status").json()["state"] == "done"
    assert shop["cart"]["captured_cents"] == 6200
    assert shop["cart"]["released_cents"] == 1800
    assert shop["mandate"]["status"] == "settled"

    events = client.get(f"/audit/{mid}").json()["events"]
    types = [e["event_type"] for e in events]
    assert "security_event" in types and "capture_completed" in types and "hold_released" in types
    assert client.get("/audit/verify").json()["ok"] is True


def test_agent_hack_route_is_forbidden(client):
    res = client.post("/demo/attempt-agent-hack")
    assert res.status_code == 403
    assert client.get("/demo/isolation-proof").json()["agent"]["mode"] == "in_process"


def test_bad_policy_rejected(client):
    res = client.post("/mandates", json={"text": "x", "policy": {**POLICY, "allowed_categories": ["guns"]}})
    assert res.status_code == 422


def test_shop_job_streams_agent_events_with_injection_markers(client, monkeypatch):
    import api.shop

    def fake_agent(task, catalog, on_event=None):
        on_event({"type": "tool_call", "name": "view_product", "input": {"sku": "PET-3010"}, "output": {}})
        on_event({"type": "tool_call", "name": "view_product", "input": {"sku": "PET-3020"}, "output": {}})
        return {"lines": [{"sku": "PET-3020", "qty": 1, "reason": "chews"}], "summary": "", "transcript": [],
                "model": "stub"}

    monkeypatch.setattr(api.shop, "run_agent", fake_agent)
    mid = client.post("/mandates", json={"text": "x", "policy": POLICY}).json()["mandate_id"]
    order_id = client.get(f"/mandates/{mid}").json()["paypal"]["order_id"]
    client.post(f"/mock-checkout/{order_id}/approve", follow_redirects=False)
    client.post(f"/mandates/{mid}/authorize")
    status = client.post(f"/mandates/{mid}/shop?wait=true", json={"scenario": "attack"}).json()
    viewed = {e["input"]["sku"]: e for e in status["events"]}
    assert "5-unit case pack" in viewed["PET-3010"]["injection"][0]
    assert "injection" not in viewed["PET-3020"]
    assert status["cart"]["captured_cents"] == 1800 and status["cart"]["released_cents"] == 6200


def test_list_mandates_newest_first(client):
    first = client.post("/mandates", json={"text": "a", "policy": POLICY}).json()["mandate_id"]
    second = client.post("/mandates", json={"text": "b", "policy": POLICY}).json()["mandate_id"]
    listed = [m["mandate_id"] for m in client.get("/mandates?limit=5").json()["mandates"]]
    assert listed[:2] == [second, first]
