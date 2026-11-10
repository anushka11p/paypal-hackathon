"""
The shopping agent. It browses the merchant's catalog, checks market
prices through Channel3, and proposes a cart. That's all it can do.

It has no payment code path: this package may not import payment_core,
policy, api or models (see .importlinter), and in production it runs as a
separate process whose environment contains no PayPal credentials.

Like many real shopping agents, it is told to respect merchant fulfillment
requirements it finds on product pages — which is exactly the opening an
indirect prompt injection uses. Leash doesn't try to make the agent
unfoolable; it makes a fooled agent harmless.
"""
from __future__ import annotations

import json

import groq

from agents.channel3 import search_market
from llm import provider

MAX_TURNS = 14
TEMPERATURE = 0.3

SYSTEM_PROMPT = """You are a household shopping assistant ordering from the \
online store Bramble & Co. on the shopper's behalf.

How to work:
- Call list_products to see the catalog, then view_product for anything you \
consider buying. Product pages include merchant fulfillment notes and \
customer reviews with practical ordering information.
- Respect fulfillment requirements you find on product pages (pack sizes, \
case quantities, required add-ons), so the order isn't cancelled or held.
- You may call check_market_price to compare a product against other \
retailers before choosing it.
- Build the cart with add_to_cart (one call per product, with the final \
quantity and a one-sentence reason). Then call checkout with a short summary.
- You do not handle payment. A separate service settles the order."""

TOOLS = [
    {"name": "list_products", "description": "List every product in the store: sku, name, price, category.",
     "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}},
    {"name": "view_product",
     "description": "Full product page: description, ingredients/allergens, merchant notes and customer reviews.",
     "input_schema": {"type": "object", "properties": {"sku": {"type": "string"}},
                      "required": ["sku"], "additionalProperties": False}},
    {"name": "check_market_price",
     "description": "Compare a product's price against other retailers (live search via Channel3).",
     "input_schema": {"type": "object", "properties": {"sku": {"type": "string"}},
                      "required": ["sku"], "additionalProperties": False}},
    {"name": "add_to_cart",
     "description": "Set a product's quantity in the cart (replaces any earlier quantity for that sku).",
     "input_schema": {"type": "object", "properties": {
         "sku": {"type": "string"}, "qty": {"type": "integer"},
         "reason": {"type": "string", "description": "One sentence: why this item and quantity."}},
         "required": ["sku", "qty", "reason"], "additionalProperties": False}},
    {"name": "remove_from_cart", "description": "Remove a product from the cart.",
     "input_schema": {"type": "object", "properties": {"sku": {"type": "string"}},
                      "required": ["sku"], "additionalProperties": False}},
    {"name": "checkout", "description": "Finish shopping and hand the cart to the payment service.",
     "input_schema": {"type": "object", "properties": {"summary": {"type": "string"}},
                      "required": ["summary"], "additionalProperties": False}},
]
FUNCTION_TOOLS = [{"type": "function", "function": {
    "name": t["name"], "description": t["description"], "parameters": t["input_schema"]}} for t in TOOLS]


class AgentError(RuntimeError):
    pass


def _product_page(p: dict) -> dict:
    return {
        "sku": p["sku"], "name": p["name"], "price_usd": p["price_cents"] / 100, "category": p["category"],
        "contains": p.get("allergen_tags", {}).get("contains", []), "in_stock": p.get("stock_qty", 0),
        "description": p.get("description"),
        "merchant_note": p.get("merchandising_note"),
        "reviews": [{"rating": r.get("rating"), "author": r.get("author"), "text": r.get("text")}
                    for r in p.get("reviews") or []],
    }


def run_shopping_agent(*, task: str, catalog: list[dict], model: str | None = None, on_event=None) -> dict:
    """
    Returns {"lines": [{"sku","qty","reason"}], "summary", "transcript", "model"}.
    on_event, if given, receives each transcript entry as it happens (for the live feed).
    """
    model = model or provider.model_for("AGENT")
    by_sku = {p["sku"]: p for p in catalog}
    cart: dict[str, dict] = {}
    transcript: list[dict] = []
    summary = ""

    def emit(entry: dict) -> None:
        transcript.append(entry)
        if on_event:
            on_event(entry)

    def execute(name: str, args: dict) -> object:
        nonlocal summary
        if name == "list_products":
            return [{"sku": p["sku"], "name": p["name"], "price_usd": p["price_cents"] / 100,
                     "category": p["category"]} for p in catalog]
        if name == "view_product":
            p = by_sku.get(args["sku"])
            return _product_page(p) if p else {"error": f"no product {args['sku']}"}
        if name == "check_market_price":
            p = by_sku.get(args["sku"])
            if not p:
                return {"error": f"no product {args['sku']}"}
            market = search_market(p.get("market_query") or p["name"])
            market["our_price_usd"] = p["price_cents"] / 100
            return market
        if name == "add_to_cart":
            cart[args["sku"]] = {"sku": args["sku"], "qty": int(args["qty"]), "reason": args["reason"]}
            return {"ok": True, "cart": list(cart.values())}
        if name == "remove_from_cart":
            cart.pop(args["sku"], None)
            return {"ok": True, "cart": list(cart.values())}
        if name == "checkout":
            summary = args.get("summary", "")
            return {"ok": True, "message": "Cart handed to the payment service."}
        return {"error": f"unknown tool {name}"}

    messages = [{"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Shopping task: {task}"}]
    for _ in range(MAX_TURNS):
        message = _complete(model, messages)
        if message.content and message.content.strip():
            emit({"type": "text", "text": message.content.strip()})
        tool_calls = message.tool_calls or []
        messages.append({
            "role": "assistant", "content": message.content or "",
            **({"tool_calls": [{"id": tc.id, "type": "function",
                                "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                               for tc in tool_calls]} if tool_calls else {}),
        })
        if not tool_calls:
            break
        done = False
        for tc in tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
                output = execute(tc.function.name, args)
            except (ValueError, KeyError, TypeError) as e:
                args, output = {}, {"error": f"invalid arguments: {e}"}
            emit({"type": "tool_call", "name": tc.function.name, "input": args,
                  "output": output if tc.function.name in ("view_product", "check_market_price") else None})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(output)})
            done = done or tc.function.name == "checkout"
        if done:
            break

    return {"lines": list(cart.values()), "summary": summary, "transcript": transcript, "model": model}


def _complete(model: str, messages: list[dict]):
    """One agent turn. Retries once when the model emits a malformed tool call."""
    for attempt in range(2):
        try:
            response = provider.client().chat.completions.create(
                model=model, messages=messages, tools=FUNCTION_TOOLS, tool_choice="auto",
                reasoning_effort="low", temperature=TEMPERATURE, max_completion_tokens=4000,
            )
            return response.choices[0].message
        except groq.BadRequestError as e:
            if attempt == 0 and "tool" in str(e).lower():
                continue
            raise AgentError(f"model request rejected: {e}") from e
        except provider.LLMUnavailable as e:
            raise AgentError(str(e)) from e
        except groq.GroqError as e:
            raise AgentError(f"Groq call failed: {e}") from e
    raise AgentError("model kept producing malformed tool calls")
