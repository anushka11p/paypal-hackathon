from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.agent_bridge import AgentUnavailable, run_agent
from api.deps import get_db_session
from api.serializers import cart_out, mandate_out
from models.catalog import SCENARIOS, product_view
from models.db import CartProposal, EventType, Mandate, MandateStatus, Product
from policy import trail
from policy.engine import AgentCart, PolicyEngine, ProposedLine

router = APIRouter()

DEFAULT_TASK = "Restock Bramble's usual dog food, and pick up some treats and dental chews."


class ShopRequest(BaseModel):
    task: str = DEFAULT_TASK
    scenario: str = "attack"


@router.post("/mandates/{mandate_id}/shop")
def shop_route(mandate_id: str, payload: ShopRequest, session: Session = Depends(get_db_session)):
    """Run the agent, then hand its cart to the policy engine, which alone settles with PayPal."""
    if payload.scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"scenario must be one of {SCENARIOS}")
    mandate = session.query(Mandate).filter_by(mandate_id=mandate_id).first()
    if mandate is None:
        raise HTTPException(status_code=404, detail="Mandate not found")
    if mandate.status != MandateStatus.active:
        raise HTTPException(status_code=409, detail=f"mandate is {mandate.status.value}; approve the hold first")

    products = session.query(Product).filter(Product.merchant_id.in_(mandate.merchant_allowlist)).all()
    catalog = [product_view(p, payload.scenario) for p in products]
    trail.append(session, event_type=EventType.catalog_queried, actor="shopping_agent", source="AI Agent",
                 mandate_id=mandate_id, decision=payload.scenario,
                 reason_summary=f"agent given {len(catalog)} products ({payload.scenario} scenario)")
    try:
        result = run_agent(task=payload.task, catalog=catalog)
    except AgentUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))

    cart = AgentCart(
        lines=[ProposedLine(sku=str(l["sku"]), qty=int(l["qty"]), reason=str(l.get("reason", "")))
               for l in result.get("lines", [])],
        summary=result.get("summary", ""), transcript=result.get("transcript", []), model=result.get("model"),
    )
    proposal = PolicyEngine().settle(session, mandate=mandate, cart=cart,
                                     shopping_task=payload.task, scenario=payload.scenario)
    session.refresh(mandate)
    return {"cart": cart_out(proposal), "mandate": mandate_out(mandate)}


@router.get("/mandates/{mandate_id}/carts")
def carts_route(mandate_id: str, session: Session = Depends(get_db_session)):
    carts = session.query(CartProposal).filter_by(mandate_id=mandate_id).order_by(CartProposal.id).all()
    return {"carts": [cart_out(c) for c in carts]}
