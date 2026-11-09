from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models.db import Merchant, get_engine, get_session_factory, init_db
from models.seed import run_seed
from payment_core.paypal_client import mode as payment_mode

DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./leash.db")

app = FastAPI(title="Leash")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{port}" for port in range(5173, 5180)],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = get_engine(DB_URL)
init_db(engine)
SessionFactory = get_session_factory(engine)

with SessionFactory() as _s:
    if _s.query(Merchant).count() == 0:
        run_seed(DB_URL)


def get_session():
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()


@app.get("/health")
def health():
    return {"status": "ok", "payments": payment_mode(),
            "agent": "separate_process" if os.environ.get("AGENT_SERVICE_URL") else "in_process"}


from api.catalog import router as catalog_router
from api.mandates import router as mandates_router
from api.shop import router as shop_router
from api.audit import router as audit_router
from api.demo import router as demo_router

for _router in (catalog_router, mandates_router, shop_router, audit_router, demo_router):
    app.include_router(_router)

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

if os.path.isdir(os.path.join(STATIC_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
