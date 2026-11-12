from __future__ import annotations

import os


def get_db_session():
    from api.main import get_session
    yield from get_session()


def public_base_url() -> str:
    """Where PayPal sends the buyer back after approval (this backend).

    Render sets RENDER_EXTERNAL_URL to the service's public address, so a hosted deploy works
    without anyone having to know that address in advance.
    """
    url = os.environ.get("PUBLIC_BASE_URL") or os.environ.get("RENDER_EXTERNAL_URL") or "http://localhost:8000"
    return url.rstrip("/")


def frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", public_base_url()).rstrip("/")
