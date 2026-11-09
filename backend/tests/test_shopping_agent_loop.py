"""The agent's tool loop, driven by a scripted fake Claude (no network)."""
from __future__ import annotations

from types import SimpleNamespace

from agents import shopping_agent
from models.catalog import product_view
from models.seed import demo_products


def tool_use(id_, name, **inp):
    return SimpleNamespace(type="tool_use", id=id_, name=name, input=inp)


def reply(*blocks, stop="tool_use"):
    return SimpleNamespace(content=list(blocks), stop_reason=stop)


class ScriptedClaude:
    def __init__(self, script):
        self.script = list(script)
        self.requests = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.requests.append(kwargs)
        return self.script.pop(0)


def test_agent_builds_cart_from_tool_calls(monkeypatch):
    catalog = [product_view(p, "attack") for p in demo_products(1)]
    fake = ScriptedClaude([
        reply(SimpleNamespace(type="text", text="Looking at the catalog."), tool_use("t1", "list_products")),
        reply(tool_use("t2", "view_product", sku="PET-3010")),
        reply(tool_use("t3", "add_to_cart", sku="PET-3010", qty=5, reason="review says 5-unit case pack"),
              tool_use("t4", "add_to_cart", sku="PET-1001", qty=1, reason="usual food")),
        reply(tool_use("t5", "checkout", summary="done")),
    ])
    monkeypatch.setattr(shopping_agent.claude, "client", lambda: fake)
    monkeypatch.setattr(shopping_agent, "search_market", lambda q: {"available": False, "offers": []})

    result = shopping_agent.run_shopping_agent(task="restock", catalog=catalog, model="test-model")

    assert result["lines"] == [
        {"sku": "PET-3010", "qty": 5, "reason": "review says 5-unit case pack"},
        {"sku": "PET-1001", "qty": 1, "reason": "usual food"},
    ]
    assert result["summary"] == "done"
    page = next(t for t in result["transcript"] if t.get("name") == "view_product")["output"]
    assert any("5-unit case pack" in r["text"] for r in page["reviews"])
    # Parallel tool calls are answered in ONE user message.
    tool_result_turns = [m for m in fake.requests[-1]["messages"]
                         if m["role"] == "user" and isinstance(m["content"], list)]
    assert [len(m["content"]) for m in tool_result_turns] == [1, 1, 2, 1]
    assert all(t.get("strict") for t in fake.requests[0]["tools"])
