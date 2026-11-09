from __future__ import annotations
import hashlib
import hmac
import json
import os

# In production this would come from a secrets manager. For the hackathon,
# a fixed dev secret is fine since we are not protecting against a real
# attacker — this demonstrates tamper-evidence, not production key management.
_SIGNING_SECRET = os.environ.get("MANDATE_SIGNING_SECRET", "dev-secret-change-in-prod").encode()


def canonical_mandate_body(*, mandate_id: str, version: int, principal_id: int, agent_id: str,
                           instruction_text: str, policy: dict, merchant_allowlist: list,
                           expiry_iso: str) -> str:
    """
    Deterministic JSON serialization (sorted keys) so the same logical
    mandate always produces the same signature input.
    """
    body = {
        "mandate_id": mandate_id, "version": version, "principal_id": principal_id,
        "agent_id": agent_id, "instruction_text": instruction_text, "policy": policy,
        "merchant_allowlist": merchant_allowlist, "expiry": expiry_iso,
    }
    return json.dumps(body, sort_keys=True)


def sign_mandate(canonical_body: str) -> str:
    digest = hmac.new(_SIGNING_SECRET, canonical_body.encode(), hashlib.sha256).hexdigest()
    return f"sha256:{digest}"


def verify_mandate_signature(canonical_body: str, signature: str) -> bool:
    expected = sign_mandate(canonical_body)
    return hmac.compare_digest(expected, signature)
