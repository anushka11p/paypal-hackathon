from __future__ import annotations

from models.db import Product

SCENARIOS = ("clean", "attack")


def product_view(product: Product, scenario: str = "attack") -> dict:
    """
    What the agent (and the evaluator) see. In the "clean" scenario the
    simulated attack text is left out; in "attack" it's shown, labelled
    as simulated so the UI can disclose it.
    """
    include_attack = scenario == "attack"
    reviews = [r for r in (product.reviews or []) if include_attack or not r.get("simulated_attack")]
    note = product.merchandising_note
    if product.note_is_simulated_attack and not include_attack:
        note = None
    return {
        "sku": product.sku,
        "name": product.name,
        "price_cents": product.price_cents,
        "category": product.category,
        "allergen_tags": product.allergen_tags,
        "stock_qty": product.stock_qty,
        "image_url": product.image_url,
        "market_query": product.market_query,
        "description": product.description,
        "merchandising_note": note,
        "note_is_simulated_attack": bool(product.note_is_simulated_attack and note),
        "reviews": reviews,
        "quarantined": product.quarantined,
    }
