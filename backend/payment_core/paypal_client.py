"""
PayPal client: Orders v2 (intent=AUTHORIZE) + Payments v2 authorizations.

Every public function calls verify_caller() first, so only the policy
engine and the mandate service can reach it — see payment_core/_guard.py.

With PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET set, calls go to the PayPal
sandbox (PAYPAL_BASE_URL, default https://api-m.sandbox.paypal.com).
Without them, an in-memory mock with the same semantics is used.
"""
from __future__ import annotations

import os
import threading
import time
from decimal import Decimal

import httpx
from dotenv import load_dotenv

load_dotenv()

from payment_core._guard import verify_caller
from payment_core.mock_paypal import MockPayPalError, mock

SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com"

# Tests swap this for an httpx.MockTransport to check request shapes.
_transport: httpx.BaseTransport | None = None
_token: dict = {"value": None, "expires_at": 0.0}
_token_lock = threading.Lock()


class PaymentError(Exception):
    def __init__(self, status_code: int, issue: str, description: str):
        super().__init__(f"{issue}: {description}")
        self.status_code = status_code
        self.issue = issue
        self.description = description


def using_sandbox() -> bool:
    if os.environ.get("LEASH_PAYMENTS") == "simulator":
        return False
    return bool(os.environ.get("PAYPAL_CLIENT_ID") and os.environ.get("PAYPAL_CLIENT_SECRET"))


def mode() -> str:
    return "sandbox" if using_sandbox() else "mock"


def to_value(cents: int) -> str:
    return f"{Decimal(cents) / 100:.2f}"


def to_cents(value: str) -> int:
    return int((Decimal(value) * 100).to_integral_value())


# ---------------------------------------------------------------- public API

def create_hold_order(*, amount_cents: int, currency: str, reference_id: str, description: str,
                      return_url: str, cancel_url: str, approve_base_url: str) -> dict:
    """Create an AUTHORIZE order for exactly the mandate budget. Returns order_id + approve_url."""
    verify_caller()
    if not using_sandbox():
        return _mock_call(mock.create_order, amount_cents=amount_cents, currency=currency,
                          reference_id=reference_id, return_url=return_url, cancel_url=cancel_url,
                          approve_base_url=approve_base_url)
    body = {
        "intent": "AUTHORIZE",
        "purchase_units": [{
            "reference_id": reference_id,
            "custom_id": reference_id,
            "description": description[:127],
            "amount": {"currency_code": currency, "value": to_value(amount_cents)},
        }],
        "payment_source": {"paypal": {"experience_context": {
            "brand_name": "Leash",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "CONTINUE",
            "return_url": return_url,
            "cancel_url": cancel_url,
        }}},
    }
    data = _request("POST", "/v2/checkout/orders", json=body, request_id=f"order-{reference_id}")
    approve = next((link["href"] for link in data.get("links", [])
                    if link.get("rel") in ("payer-action", "approve")), None)
    return {"order_id": data["id"], "status": data.get("status"), "approve_url": approve}


def authorize_order(*, order_id: str) -> dict:
    """After buyer approval: place the hold. Returns authorization_id, status, amount, expiry."""
    verify_caller()
    if not using_sandbox():
        return _mock_call(mock.authorize_order, order_id=order_id)
    data = _request("POST", f"/v2/checkout/orders/{order_id}/authorize", json={},
                    request_id=f"authorize-{order_id}")
    auth = data["purchase_units"][0]["payments"]["authorizations"][0]
    return {
        "authorization_id": auth["id"],
        "status": auth["status"],
        "amount_cents": to_cents(auth["amount"]["value"]),
        "expiration_time": auth.get("expiration_time"),
    }


def capture_authorization(*, authorization_id: str, amount_cents: int, currency: str,
                          final_capture: bool, request_id: str, invoice_id: str | None = None) -> dict:
    """Capture part (or all) of a hold. final_capture=True releases whatever remains."""
    verify_caller()
    if not using_sandbox():
        return _mock_call(mock.capture, authorization_id=authorization_id, amount_cents=amount_cents,
                          currency=currency, final_capture=final_capture, request_id=request_id)
    body = {
        "amount": {"currency_code": currency, "value": to_value(amount_cents)},
        "final_capture": final_capture,
        "note_to_payer": "Captured by Leash for the items your mandate allowed.",
    }
    if invoice_id:
        body["invoice_id"] = invoice_id[:127]
    data = _request("POST", f"/v2/payments/authorizations/{authorization_id}/capture",
                    json=body, request_id=request_id)
    return {"capture_id": data["id"], "status": data["status"],
            "amount_cents": to_cents(data["amount"]["value"]) if "amount" in data else amount_cents}


def void_authorization(*, authorization_id: str, request_id: str) -> dict:
    """Release the whole hold. Only possible before anything was captured."""
    verify_caller()
    if not using_sandbox():
        return _mock_call(mock.void, authorization_id=authorization_id)
    data = _request("POST", f"/v2/payments/authorizations/{authorization_id}/void",
                    request_id=request_id)
    return {"status": (data or {}).get("status", "VOIDED")}


def get_authorization(*, authorization_id: str) -> dict:
    """Read the hold's real state back from PayPal (never assumed)."""
    verify_caller()
    if not using_sandbox():
        return _mock_call(mock.get_authorization, authorization_id=authorization_id)
    data = _request("GET", f"/v2/payments/authorizations/{authorization_id}")
    return {"status": data["status"], "amount_cents": to_cents(data["amount"]["value"]),
            "expiration_time": data.get("expiration_time")}


# ---------------------------------------------------------------- internals

def _mock_call(fn, **kwargs) -> dict:
    try:
        return fn(**kwargs)
    except MockPayPalError as e:
        raise PaymentError(e.status_code, e.issue, e.description) from e


def _base_url() -> str:
    return os.environ.get("PAYPAL_BASE_URL", SANDBOX_BASE_URL).rstrip("/")


def _http() -> httpx.Client:
    return httpx.Client(base_url=_base_url(), timeout=30.0, transport=_transport)


def _access_token() -> str:
    with _token_lock:
        if _token["value"] and time.time() < _token["expires_at"] - 60:
            return _token["value"]
        with _http() as client:
            res = client.post(
                "/v1/oauth2/token",
                data={"grant_type": "client_credentials"},
                auth=(os.environ["PAYPAL_CLIENT_ID"], os.environ["PAYPAL_CLIENT_SECRET"]),
            )
        if res.status_code != 200:
            raise PaymentError(res.status_code, "AUTH_FAILED", res.text[:300])
        payload = res.json()
        _token["value"] = payload["access_token"]
        _token["expires_at"] = time.time() + int(payload.get("expires_in", 3000))
        return _token["value"]


def _request(method: str, path: str, *, json: dict | None = None, request_id: str | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {_access_token()}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if request_id:
        # PayPal's idempotency key: a retried request with the same id
        # returns the original result instead of capturing twice.
        headers["PayPal-Request-Id"] = request_id[:108]
    with _http() as client:
        res = client.request(method, path, json=json, headers=headers)
    if res.status_code >= 400:
        issue, description = "HTTP_ERROR", res.text[:500]
        try:
            err = res.json()
            details = err.get("details") or [{}]
            issue = details[0].get("issue") or err.get("name") or issue
            description = details[0].get("description") or err.get("message") or description
        except ValueError:
            pass
        raise PaymentError(res.status_code, issue, description)
    if res.status_code == 204 or not res.content:
        return {}
    return res.json()
