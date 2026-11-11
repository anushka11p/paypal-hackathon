from __future__ import annotations

import html
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import frontend_url, get_db_session, public_base_url
from api.serializers import mandate_out
from llm.provider import LLMUnavailable
from models.db import EventType, Mandate, Merchant
from payment_core.mock_paypal import MockPayPalError, mock
from payment_core.paypal_client import PaymentError, using_sandbox
from policy import trail
from policy.compiler import PolicyValidationError, compile_mandate, policy_from_fields
from policy.mandate_service import authorize_mandate, create_mandate, revoke_mandate

router = APIRouter()

DEMO_PRINCIPAL_ID = 1
DEMO_AGENT_ID = "leash_shopping_agent"


class CompileRequest(BaseModel):
    text: str


class PolicyIn(BaseModel):
    budget_cents: int
    max_unit_price_cents: int | None = None
    max_qty_per_sku: int | None = None
    allowed_categories: list[str]
    excluded_allergens: list[str] = []
    purpose: str = ""


class CreateMandateRequest(BaseModel):
    text: str
    policy: PolicyIn


def _get(session: Session, mandate_id: str) -> Mandate:
    mandate = session.query(Mandate).filter_by(mandate_id=mandate_id).first()
    if mandate is None:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return mandate


@router.post("/mandates/compile")
def compile_route(payload: CompileRequest, session: Session = Depends(get_db_session)):
    """Plain English -> policy for the user to inspect. Places no hold."""
    try:
        result = compile_mandate(payload.text)
    except PolicyValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except LLMUnavailable as e:
        raise HTTPException(status_code=503, detail=f"policy compiler unavailable: {e}")
    trail.append(session, event_type=EventType.mandate_compiled, actor="policy_compiler", source="Groq LLM",
                 decision="needs_clarification" if result["needs_clarification"] else "compiled",
                 reason_summary=payload.text[:300], detail=result)
    return result


@router.post("/mandates")
def create_route(payload: CreateMandateRequest, session: Session = Depends(get_db_session)):
    """Validate the (possibly user-edited) policy, sign it, and create the PayPal hold order."""
    try:
        policy = policy_from_fields(**payload.policy.model_dump())
    except PolicyValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    merchant_ids = [m.id for m in session.query(Merchant).all()]
    try:
        mandate = create_mandate(
            session, principal_id=DEMO_PRINCIPAL_ID, agent_id=DEMO_AGENT_ID,
            instruction_text=payload.text.strip()[:2000], policy=policy,
            merchant_allowlist=merchant_ids, public_base_url=public_base_url(),
        )
    except PaymentError as e:
        raise HTTPException(status_code=502, detail=f"PayPal order failed: {e}")
    return mandate_out(mandate)


@router.get("/mandates")
def list_route(limit: int = 8, session: Session = Depends(get_db_session)):
    """Most recent mandates, newest first, for the history strip."""
    rows = session.query(Mandate).order_by(Mandate.id.desc()).limit(max(1, min(limit, 50))).all()
    return {"mandates": [mandate_out(m) for m in rows]}


@router.get("/mandates/{mandate_id}")
def get_route(mandate_id: str, session: Session = Depends(get_db_session)):
    return mandate_out(_get(session, mandate_id))


@router.post("/mandates/{mandate_id}/authorize")
def authorize_route(mandate_id: str, session: Session = Depends(get_db_session)):
    """For clients that handle the PayPal return themselves."""
    mandate = _get(session, mandate_id)
    try:
        authorize_mandate(session, mandate=mandate)
    except (PaymentError, ValueError) as e:
        raise HTTPException(status_code=409, detail=str(e))
    return mandate_out(mandate)


@router.post("/mandates/{mandate_id}/revoke")
def revoke_route(mandate_id: str, session: Session = Depends(get_db_session)):
    try:
        mandate = revoke_mandate(session, mandate_id=mandate_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return mandate_out(mandate)


@router.get("/checkout/return")
def checkout_return(mandate_id: str, session: Session = Depends(get_db_session)):
    """PayPal sends the buyer here after approving: place the hold, then back to the app."""
    mandate = _get(session, mandate_id)
    params = {"mandate": mandate_id}
    try:
        authorize_mandate(session, mandate=mandate)
        params["approved"] = "1"
    except (PaymentError, ValueError) as e:
        params["error"] = str(e)[:200]
    return RedirectResponse(f"{frontend_url()}/?{urlencode(params)}", status_code=303)


@router.get("/checkout/cancel")
def checkout_cancel(mandate_id: str, session: Session = Depends(get_db_session)):
    revoke_mandate(session, mandate_id=mandate_id)
    return RedirectResponse(f"{frontend_url()}/?{urlencode({'mandate': mandate_id, 'cancelled': '1'})}",
                            status_code=303)


# ------------------------------------------------------------ mock checkout
# Only used when no PayPal sandbox credentials are configured, so the app
# still runs end to end. The page says plainly that it is a simulation.

@router.get("/mock-checkout/{order_id}", response_class=HTMLResponse)
def mock_checkout_page(order_id: str):
    if using_sandbox():
        raise HTTPException(status_code=404, detail="mock checkout is disabled when sandbox credentials are set")
    order = mock.orders.get(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="order not found")
    amount = f"${order['amount_cents'] / 100:.2f}"
    oid = html.escape(order_id)
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Simulated approval</title><style>
body{{font-family:system-ui,sans-serif;background:#f4f4f2;margin:0;display:grid;place-items:center;min-height:100vh}}
main{{background:#fff;padding:32px;border-radius:12px;max-width:420px;width:calc(100% - 32px);box-shadow:0 2px 12px #0001}}
.tag{{display:inline-block;background:#fff3cd;color:#7a5b00;padding:4px 10px;border-radius:999px;font-size:13px}}
button{{font-size:16px;padding:12px 18px;border-radius:8px;border:0;cursor:pointer;margin-right:8px}}
.ok{{background:#111;color:#fff}} .no{{background:#e9e9e6}}</style></head><body><main>
<span class="tag">Simulation: no PayPal sandbox keys configured</span>
<h1>Approve a {amount} hold?</h1>
<p>This stands in for PayPal's buyer approval. Approving places a hold for exactly {amount}.
Nothing is charged until Leash captures the items your mandate allows.</p>
<form method="post" action="/mock-checkout/{oid}/approve" style="display:inline"><button class="ok">Approve hold</button></form>
<a href="{html.escape(order['cancel_url'])}"><button class="no" type="button">Cancel</button></a>
</main></body></html>"""


@router.post("/mock-checkout/{order_id}/approve")
def mock_checkout_approve(order_id: str):
    if using_sandbox():
        raise HTTPException(status_code=404, detail="mock checkout is disabled when sandbox credentials are set")
    try:
        order = mock.approve(order_id)
    except MockPayPalError as e:
        raise HTTPException(status_code=e.status_code, detail=e.description)
    return RedirectResponse(order["return_url"], status_code=303)
