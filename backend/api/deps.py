from __future__ import annotations

import os


def get_db_session():
    from api.main import get_session
    yield from get_session()


def public_base_url() -> str:
    """Where PayPal sends the buyer back after approval (this backend)."""
    return os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")


def frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", public_base_url()).rstrip("/")
