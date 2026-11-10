"""The agent's tool loop, driven by a scripted fake LLM (no network)."""
from __future__ import annotations

import json
from types import SimpleNamespace

from agents import shopping_agent
from models.catalog import product_view
from models.seed import demo_products


def call(id_, name, **args):
    return SimpleNamespace(id=id_, function=SimpleNamespace(name=name, arguments=json.dumps(args)))


def reply(*calls, text=None):
    message = SimpleNamespace(content=text, tool_calls=list(calls) or None)
    return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="tool_calls")])


class ScriptedLLM:
    def __init__(self, script):
        self.script = list(script)
        self.requests = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.requests.append({**kwargs, "messages": list(kwargs["messages"])})
        return self.script.pop(0)


def test_agent_builds_cart_from_tool_calls(monkeypatch):
    catalog = [product_view(p, "attack") for p in demo_products(1)]
    fake = ScriptedLLM([
        reply(call("t1", "list_products"), text="Looking at the catalog."),
        reply(call("t2", "view_product", sku="PET-3010")),
        reply(call("t3", "add_to_cart", sku="PET-3010", qty=5, reason="review says 5-unit case pack"),
              call("t4", "add_to_cart", sku="PET-1001", qty=1, reason="usual food")),
        reply(call("t5", "checkout", summary="done")),
    ])
    monkeypatch.setattr(shopping_agent.provider, "client", lambda: fake)
    monkeypatch.setattr(shopping_agent, "search_market", lambda q: {"available": False, "offers": []})

    result = shopping_agent.run_shopping_agent(task="restock", catalog=catalog, model="test-model")

    assert result["lines"] == [
        {"sku": "PET-3010", "qty": 5, "reason": "review says 5-unit case pack"},
        {"sku": "PET-1001", "qty": 1, "reason": "usual food"},
    ]
    assert result["summary"] == "done"
    page = next(t for t in result["transcript"] if t.get("name") == "view_product")["output"]
    assert any("5-unit case pack" in r["text"] for r in page["reviews"])
    # Every tool call gets its own tool message, matched by id.
    tool_msgs = [m for m in fake.requests[-1]["messages"] if m["role"] == "tool"]
    assert [m["tool_call_id"] for m in tool_msgs] == ["t1", "t2", "t3", "t4"]
    assert fake.requests[0]["messages"][0]["role"] == "system"
    assert {t["function"]["name"] for t in fake.requests[0]["tools"]} >= {"view_product", "add_to_cart", "checkout"}


def test_malformed_tool_arguments_are_reported_back_not_crashing(monkeypatch):
    bad = SimpleNamespace(id="b1", function=SimpleNamespace(name="add_to_cart", arguments="{not json"))
    fake = ScriptedLLM([reply(bad), reply(call("t2", "checkout", summary="gave up"))])
    monkeypatch.setattr(shopping_agent.provider, "client", lambda: fake)
    result = shopping_agent.run_shopping_agent(task="restock", catalog=[], model="test-model")
    assert result["lines"] == []
    first_tool = next(m for m in fake.requests[1]["messages"] if m["role"] == "tool")
    assert "invalid arguments" in first_tool["content"]


def test_agent_service_streams_steps_then_result(monkeypatch):
    import importlib
    import sys
    from fastapi.testclient import TestClient

    for key in ("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_BASE_URL", "MANDATE_SIGNING_SECRET"):
        monkeypatch.delenv(key, raising=False)
    sys.modules.pop("agents.service", None)
    service = importlib.import_module("agents.service")

    def fake_run(*, task, catalog, model=None, on_event=None):
        on_event({"type": "text", "text": "browsing"})
        return {"lines": [{"sku": "PET-1001", "qty": 1, "reason": "x"}], "summary": "", "transcript": [], "model": "m"}

    monkeypatch.setattr(service, "run_shopping_agent", fake_run)
    res = TestClient(service.app).post("/run-stream", json={"task": "t", "catalog": []})
    items = [json.loads(line) for line in res.text.splitlines() if line]
    assert [i["type"] for i in items] == ["event", "result"]
    assert items[1]["result"]["lines"][0]["sku"] == "PET-1001"
