"""Channel3 product search: live market prices across retailers for the agent."""
from __future__ import annotations

import os

import httpx

BASE_URL = "https://api.trychannel3.com"


def search_market(query: str, limit: int = 5) -> dict:
    key = os.environ.get("CHANNEL3_API_KEY")
    if not key:
        return {"available": False, "reason": "CHANNEL3_API_KEY not set", "offers": []}
    try:
        res = httpx.post(
            f"{BASE_URL}/v1/search",
            headers={"x-api-key": key, "Content-Type": "application/json"},
            json={"query": query[:200], "limit": max(1, min(limit, 10))},
            timeout=20.0,
        )
        res.raise_for_status()
    except httpx.HTTPError as e:
        return {"available": False, "reason": f"Channel3 request failed: {e}", "offers": []}

    offers = []
    for product in res.json().get("products", []):
        for offer in product.get("offers") or []:
            price = (offer.get("price") or {})
            if price.get("price") is None:
                continue
            offers.append({
                "title": product.get("title"),
                "brand": ", ".join(b.get("name", "") for b in product.get("brands") or []) or None,
                "price": price.get("price"),
                "currency": price.get("currency"),
                "retailer": offer.get("domain"),
                "url": offer.get("url"),
                "in_stock": offer.get("availability") == "InStock",
            })
            break  # one offer per product keeps the agent's context small
    prices = [o["price"] for o in offers if o["currency"] in (None, "USD")]
    return {
        "available": True,
        "query": query,
        "offers": offers[:limit],
        "lowest_usd": min(prices) if prices else None,
        "median_usd": sorted(prices)[len(prices) // 2] if prices else None,
    }
