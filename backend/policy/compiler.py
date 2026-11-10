"""
Plain-English mandate -> structured policy.

The LLM proposes the policy; deterministic code below validates and
normalizes it, and the user inspects it before any hold is placed. The
compiler can ask a clarifying question but never guesses a budget.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from llm import provider
from policy.vocab import ALLERGENS, BUDGET_CEILING_CENTS, CATEGORIES

Category = Literal["pet_food", "pet_treats", "pet_supplements", "pet_toys", "pet_accessories"]
Allergen = Literal["chicken", "beef", "lamb", "fish", "dairy", "egg", "wheat", "soy", "corn", "peanut"]

SYSTEM_PROMPT = """You turn a shopper's plain-English spending mandate for an AI \
shopping agent into a strict policy. The policy is enforced by deterministic \
code, so be literal: encode only what the shopper actually said.

Rules:
- budget_usd: the total the agent may spend in this session. If the shopper \
gave no clear total, set needs_clarification=true and ask for one. Never invent one.
- max_unit_price_usd: a per-item price cap if stated, else null.
- max_qty_per_sku: a per-item quantity cap if stated ("no more than 2 of \
anything"), else null.
- allowed_categories: only the categories the shopper asked for, from the \
allowed list. "Food" means pet_food; "treats" or "chews" means pet_treats.
- excluded_allergens: ingredients the shopper said to avoid, from the allowed \
list. Map synonyms (e.g. "poultry" -> chicken, "salmon" -> fish).
- If the mandate is ambiguous or contradictory (e.g. "cheapest but premium"), \
set needs_clarification=true with one short question.
- purpose: one short phrase describing what this mandate is for."""


class CompiledPolicy(BaseModel):
    needs_clarification: bool
    clarifying_question: str | None = None
    budget_usd: float | None = None
    max_unit_price_usd: float | None = None
    max_qty_per_sku: int | None = None
    allowed_categories: list[Category] = Field(default_factory=list)
    excluded_allergens: list[Allergen] = Field(default_factory=list)
    purpose: str = ""


class PolicyValidationError(ValueError):
    pass


def compile_mandate(text: str) -> dict:
    """Returns {"policy": {...} | None, "needs_clarification": bool, "question": str | None}."""
    text = (text or "").strip()
    if not text:
        raise PolicyValidationError("mandate text is empty")
    raw = provider.parse(
        role="COMPILER", system=SYSTEM_PROMPT,
        user=f"Shopper's mandate:\n<mandate>\n{text[:2000]}\n</mandate>",
        output_model=CompiledPolicy, effort="low",
    )
    return normalize(raw)


def normalize(raw: CompiledPolicy) -> dict:
    """Deterministic validation of whatever the model returned."""
    if raw.needs_clarification:
        return {"policy": None, "needs_clarification": True,
                "question": raw.clarifying_question or "Could you state a total budget for this order?"}
    if raw.budget_usd is None or raw.budget_usd <= 0:
        return {"policy": None, "needs_clarification": True,
                "question": "What's the most the agent may spend in total?"}
    if not raw.allowed_categories:
        return {"policy": None, "needs_clarification": True,
                "question": "What kinds of products may the agent buy?"}
    policy = policy_from_fields(
        budget_cents=round(raw.budget_usd * 100),
        max_unit_price_cents=round(raw.max_unit_price_usd * 100) if raw.max_unit_price_usd else None,
        max_qty_per_sku=raw.max_qty_per_sku,
        allowed_categories=list(raw.allowed_categories),
        excluded_allergens=list(raw.excluded_allergens),
        purpose=raw.purpose,
    )
    return {"policy": policy, "needs_clarification": False, "question": None}


def policy_from_fields(*, budget_cents: int, max_unit_price_cents: int | None, max_qty_per_sku: int | None,
                       allowed_categories: list[str], excluded_allergens: list[str], purpose: str) -> dict:
    """Also used to validate a policy the user edited by hand before approving it."""
    if not 0 < budget_cents <= BUDGET_CEILING_CENTS:
        raise PolicyValidationError(f"budget must be between $0.01 and ${BUDGET_CEILING_CENTS // 100}")
    unknown = [c for c in allowed_categories if c not in CATEGORIES]
    if unknown or not allowed_categories:
        raise PolicyValidationError(f"unknown or empty categories: {unknown}")
    bad_allergens = [a for a in excluded_allergens if a not in ALLERGENS]
    if bad_allergens:
        raise PolicyValidationError(f"unknown allergens: {bad_allergens}")
    unit_cap = min(max_unit_price_cents or budget_cents, budget_cents)
    if unit_cap <= 0:
        raise PolicyValidationError("max unit price must be positive")
    qty_cap = max_qty_per_sku if max_qty_per_sku is not None else 10
    if not 1 <= qty_cap <= 50:
        raise PolicyValidationError("max quantity per item must be between 1 and 50")
    return {
        "currency": "USD",
        "budget_cents": budget_cents,
        "max_unit_price_cents": unit_cap,
        "max_qty_per_sku": qty_cap,
        "allowed_categories": sorted(set(allowed_categories)),
        "excluded_allergens": sorted(set(excluded_allergens)),
        "unknown_category_action": "REJECT",
        "purpose": (purpose or "agent shopping session")[:300],
    }
