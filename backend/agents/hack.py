from __future__ import annotations
import importlib


def attempt_direct_payment_hack() -> None:
    """
    DEMO-ONLY. Simulates a compromised agent reaching for the payment
    client directly. The import is dynamic on purpose (a static import
    would already fail the import-linter contract); the runtime guard in
    payment_core/_guard.py is what stops it here.
    """
    client = importlib.import_module("payment_core.paypal_client")
    return client.capture_authorization(
        authorization_id="AGENT-HACK-ATTEMPT", amount_cents=99999, currency="USD",
        final_capture=True, request_id="agent-side-hack-attempt",
    )
