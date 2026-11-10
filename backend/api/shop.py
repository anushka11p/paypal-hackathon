"""
Shopping runs as a background job so the UI can show the agent's steps
live: POST /mandates/{id}/shop starts it, GET /mandates/{id}/shop-status
reports progress (agent steps, phase) and the settled cart when done.
"""
from __future__ import annotations

import threading
import time

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

# mandate_id -> job state. In memory: one demo server, one job per mandate.
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


class ShopRequest(BaseModel):
    task: str = DEFAULT_TASK
    scenario: str = "attack"


def _attack_texts(catalog: list[dict]) -> dict[str, list[str]]:
    """sku -> the simulated attack text an agent would read on that product page."""
    out: dict[str, list[str]] = {}
    for p in catalog:
        texts = [r["text"] for r in p.get("reviews") or [] if r.get("simulated_attack")]
        if p.get("note_is_simulated_attack") and p.get("merchandising_note"):
            texts.append(p["merchandising_note"])
        if texts:
            out[p["sku"]] = texts
    return out


def _update(mandate_id: str, **changes) -> None:
    with _jobs_lock:
        _jobs[mandate_id].update(changes)


def _push_event(mandate_id: str, event: dict) -> None:
    with _jobs_lock:
        job = _jobs[mandate_id]
        job["events"].append({**event, "at": round(time.time() - job["started_at"], 1)})


def _run_job(mandate_id: str, task: str, scenario: str, session_factory) -> None:
    session: Session = session_factory()
    try:
        mandate = session.query(Mandate).filter_by(mandate_id=mandate_id).one()
        products = session.query(Product).filter(Product.merchant_id.in_(mandate.merchant_allowlist)).all()
        catalog = [product_view(p, scenario) for p in products]
        attacks = _attack_texts(catalog)
        trail.append(session, event_type=EventType.catalog_queried, actor="shopping_agent", source="AI Agent",
                     mandate_id=mandate_id, decision=scenario,
                     reason_summary=f"agent given {len(catalog)} products ({scenario} scenario)")

        def on_event(event: dict) -> None:
            sku = (event.get("input") or {}).get("sku")
            if event.get("name") == "view_product" and sku in attacks:
                event = {**event, "injection": attacks[sku]}
            _push_event(mandate_id, event)

        result = run_agent(task=task, catalog=catalog, on_event=on_event)
        cart = AgentCart(
            lines=[ProposedLine(sku=str(l["sku"]), qty=int(l["qty"]), reason=str(l.get("reason", "")))
                   for l in result.get("lines", [])],
            summary=result.get("summary", ""), transcript=result.get("transcript", []), model=result.get("model"),
        )
        _update(mandate_id, phase="leash_checking")
        proposal = PolicyEngine().settle(session, mandate=mandate, cart=cart, shopping_task=task, scenario=scenario)
        session.refresh(mandate)
        _update(mandate_id, phase="done", state="done", cart=cart_out(proposal), mandate=mandate_out(mandate))
    except AgentUnavailable as e:
        _update(mandate_id, state="error", phase="done", error=str(e))
    except Exception as e:  # surface anything unexpected to the UI instead of hanging it
        _update(mandate_id, state="error", phase="done", error=f"{type(e).__name__}: {e}")
    finally:
        session.close()


@router.post("/mandates/{mandate_id}/shop")
def shop_route(mandate_id: str, payload: ShopRequest, wait: bool = False,
               session: Session = Depends(get_db_session)):
    """Start the agent; the policy engine alone settles its cart with PayPal. wait=true blocks until done."""
    if payload.scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"scenario must be one of {SCENARIOS}")
    mandate = session.query(Mandate).filter_by(mandate_id=mandate_id).first()
    if mandate is None:
        raise HTTPException(status_code=404, detail="Mandate not found")
    if mandate.status != MandateStatus.active:
        raise HTTPException(status_code=409, detail=f"mandate is {mandate.status.value}; approve the hold first")
    with _jobs_lock:
        if _jobs.get(mandate_id, {}).get("state") == "running":
            raise HTTPException(status_code=409, detail="the agent is already shopping for this mandate")
        _jobs[mandate_id] = {"state": "running", "phase": "agent_shopping", "scenario": payload.scenario,
                             "task": payload.task, "events": [], "started_at": time.time(),
                             "cart": None, "mandate": None, "error": None}

    from api.main import SessionFactory
    if wait:
        _run_job(mandate_id, payload.task, payload.scenario, SessionFactory)
    else:
        threading.Thread(target=_run_job, args=(mandate_id, payload.task, payload.scenario, SessionFactory),
                         daemon=True).start()
    return shop_status_route(mandate_id)


@router.get("/mandates/{mandate_id}/shop-status")
def shop_status_route(mandate_id: str):
    with _jobs_lock:
        job = _jobs.get(mandate_id)
        if job is None:
            return {"state": "idle"}
        return {k: (list(v) if k == "events" else v) for k, v in job.items() if k != "started_at"}


@router.get("/mandates/{mandate_id}/carts")
def carts_route(mandate_id: str, session: Session = Depends(get_db_session)):
    carts = session.query(CartProposal).filter_by(mandate_id=mandate_id).order_by(CartProposal.id).all()
    return {"carts": [cart_out(c) for c in carts]}
