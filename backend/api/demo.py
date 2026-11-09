from __future__ import annotations

from fastapi import APIRouter, HTTPException

from agents.hack import attempt_direct_payment_hack
from api.agent_bridge import agent_env_proof
from payment_core._guard import PaymentAccessDenied
from payment_core.paypal_client import mode as payment_mode

router = APIRouter()


@router.post("/demo/attempt-agent-hack")
def attempt_agent_hack_route():
    """
    DEMO-ONLY: agent-package code tries to call the PayPal client directly.
    Should always return 403.
    """
    try:
        attempt_direct_payment_hack()
        # If we ever get here, the isolation boundary has failed. This is
        # intentionally left without a success response.
        raise HTTPException(status_code=500, detail="ISOLATION BOUNDARY FAILURE — investigate immediately")
    except PaymentAccessDenied as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/demo/isolation-proof")
def isolation_proof():
    return {
        "payments_mode": payment_mode(),
        "agent": agent_env_proof(),
        "runtime_guard": "payment_core/_guard.py allows only policy/engine.py and policy/mandate_service.py",
        "static_contract": ".importlinter: agents may not import payment_core, policy, api or models",
    }
