"""
In-memory stand-in for the PayPal Orders v2 + Payments v2 authorization
flow, used by tests and when no sandbox credentials are configured.

It deliberately mirrors PayPal's over-capture allowance (up to 115% of the
authorized amount or $75 more, whichever is less) so that Leash's own
`capture <= remaining hold` invariant is what the tests exercise, not a
limit the mock happens to enforce for us.
"""
from __future__ import annotations

import itertools
import threading
from datetime import datetime, timedelta, timezone

_ids = itertools.count(1)
_lock = threading.Lock()


class MockPayPalError(Exception):
    def __init__(self, status_code: int, issue: str, description: str):
        super().__init__(f"{issue}: {description}")
        self.status_code = status_code
        self.issue = issue
        self.description = description


def _next(prefix: str) -> str:
    return f"{prefix}{next(_ids):08d}MOCK"


def max_capturable_cents(authorized_cents: int) -> int:
    return authorized_cents + min(authorized_cents * 15 // 100, 7500)


class MockPayPal:
    def __init__(self):
        self.orders: dict[str, dict] = {}
        self.authorizations: dict[str, dict] = {}
        self.captures_by_request_id: dict[str, dict] = {}

    def reset(self):
        self.__init__()

    def create_order(self, *, amount_cents: int, currency: str, reference_id: str,
                     return_url: str, cancel_url: str, approve_base_url: str) -> dict:
        with _lock:
            order_id = _next("ORD")
            self.orders[order_id] = {
                "id": order_id, "status": "CREATED", "amount_cents": amount_cents,
                "currency": currency, "reference_id": reference_id,
                "return_url": return_url, "cancel_url": cancel_url,
            }
            return {
                "order_id": order_id, "status": "PAYER_ACTION_REQUIRED",
                "approve_url": f"{approve_base_url}/mock-checkout/{order_id}",
            }

    def approve(self, order_id: str) -> dict:
        with _lock:
            order = self._order(order_id)
            if order["status"] != "CREATED":
                raise MockPayPalError(422, "ORDER_NOT_APPROVABLE", f"order is {order['status']}")
            order["status"] = "APPROVED"
            return order

    def authorize_order(self, *, order_id: str) -> dict:
        with _lock:
            order = self._order(order_id)
            if order["status"] != "APPROVED":
                raise MockPayPalError(422, "ORDER_NOT_APPROVED", "payer has not approved the order")
            order["status"] = "COMPLETED"
            auth_id = _next("AUTH")
            expires = (datetime.now(timezone.utc) + timedelta(days=29)).strftime("%Y-%m-%dT%H:%M:%SZ")
            self.authorizations[auth_id] = {
                "id": auth_id, "status": "CREATED", "amount_cents": order["amount_cents"],
                "currency": order["currency"], "captured_cents": 0, "expiration_time": expires,
            }
            return {"authorization_id": auth_id, "status": "CREATED",
                    "amount_cents": order["amount_cents"], "expiration_time": expires}

    def capture(self, *, authorization_id: str, amount_cents: int, currency: str,
                final_capture: bool, request_id: str) -> dict:
        with _lock:
            if request_id in self.captures_by_request_id:
                return self.captures_by_request_id[request_id]
            auth = self._auth(authorization_id)
            if auth["status"] not in ("CREATED", "PARTIALLY_CAPTURED"):
                raise MockPayPalError(422, "AUTHORIZATION_ALREADY_CAPTURED" if auth["status"] == "CAPTURED"
                                      else "AUTHORIZATION_VOIDED", f"authorization is {auth['status']}")
            if currency != auth["currency"]:
                raise MockPayPalError(422, "CURRENCY_MISMATCH", "capture currency differs from authorization")
            if auth["captured_cents"] + amount_cents > max_capturable_cents(auth["amount_cents"]):
                raise MockPayPalError(422, "MAX_CAPTURE_AMOUNT_EXCEEDED", "over-capture limit exceeded")
            auth["captured_cents"] += amount_cents
            auth["status"] = "CAPTURED" if final_capture or auth["captured_cents"] >= auth["amount_cents"] \
                else "PARTIALLY_CAPTURED"
            result = {"capture_id": _next("CAP"), "status": "COMPLETED", "amount_cents": amount_cents}
            self.captures_by_request_id[request_id] = result
            return result

    def void(self, *, authorization_id: str) -> dict:
        with _lock:
            auth = self._auth(authorization_id)
            if auth["captured_cents"] > 0:
                raise MockPayPalError(422, "PREVIOUSLY_CAPTURED",
                                      "Authorization has been previously captured and cannot be voided.")
            if auth["status"] == "VOIDED":
                return {"status": "VOIDED"}
            auth["status"] = "VOIDED"
            return {"status": "VOIDED"}

    def get_authorization(self, *, authorization_id: str) -> dict:
        auth = self._auth(authorization_id)
        return {"status": auth["status"], "amount_cents": auth["amount_cents"],
                "expiration_time": auth["expiration_time"]}

    def _order(self, order_id: str) -> dict:
        if order_id not in self.orders:
            raise MockPayPalError(404, "RESOURCE_NOT_FOUND", f"order {order_id} not found")
        return self.orders[order_id]

    def _auth(self, authorization_id: str) -> dict:
        if authorization_id not in self.authorizations:
            raise MockPayPalError(404, "RESOURCE_NOT_FOUND", f"authorization {authorization_id} not found")
        return self.authorizations[authorization_id]


mock = MockPayPal()
