from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db_session
from models.catalog import SCENARIOS, product_view
from models.db import Merchant, Product

router = APIRouter()


@router.get("/catalog")
@router.get("/catalog/{merchant_id}")
def get_catalog(merchant_id: int = 1, scenario: str = "attack", session: Session = Depends(get_db_session)):
    if scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"scenario must be one of {SCENARIOS}")
    merchant = session.query(Merchant).filter_by(id=merchant_id).first()
    if merchant is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    products = session.query(Product).filter_by(merchant_id=merchant_id).order_by(Product.sku).all()
    # Untrusted text IS returned here — it's what a shopper or agent would
    # see. The invariant is that the policy engine never reads it.
    return {
        "merchant": {"id": merchant.id, "name": merchant.name},
        "scenario": scenario,
        "products": [product_view(p, scenario) for p in products],
    }
