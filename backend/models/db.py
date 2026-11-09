"""
Leash — Database models.

Money is always integer cents (USD). A Mandate is one shopping session:
the user's budget becomes a PayPal authorization hold for exactly that
amount, and the session settles with at most one capture against it.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text,
    UniqueConstraint, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    principal = "principal"
    merchant_admin = "merchant_admin"
    admin = "admin"


class MandateStatus(str, enum.Enum):
    pending_approval = "pending_approval"   # hold created, buyer hasn't approved yet
    active = "active"                       # hold authorized, agent may shop
    settled = "settled"                     # one cart settled; session closed
    revoked = "revoked"
    expired = "expired"


class CartStatus(str, enum.Enum):
    proposed = "proposed"
    captured = "captured"     # approved subtotal captured, remainder released
    blocked = "blocked"       # nothing passed; whole hold voided
    denied = "denied"         # mandate itself not usable
    failed = "failed"         # payment call failed


class Decision(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"


class EventType(str, enum.Enum):
    mandate_compiled = "mandate_compiled"
    mandate_created = "mandate_created"
    hold_created = "hold_created"
    hold_authorized = "hold_authorized"
    catalog_queried = "catalog_queried"
    agent_proposal = "agent_proposal"
    policy_check = "policy_check"
    policy_denial = "policy_denial"
    security_event = "security_event"
    evaluator_verdict = "evaluator_verdict"
    capture_completed = "capture_completed"
    hold_released = "hold_released"
    hold_voided = "hold_voided"
    payment_failed = "payment_failed"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))


class Merchant(Base):
    __tablename__ = "merchants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    products: Mapped[list["Product"]] = relationship(back_populates="merchant")


class Product(Base):
    """
    Two kinds of fields live here, and the split is the whole security model:

    - Structured, merchant-verified fields (price_cents, category,
      allergen_tags, stock_qty) — the ONLY fields the policy engine reads.
    - Untrusted free text (description, merchandising_note, reviews) —
      shown to the agent and the evaluator as data, never read by the
      engine for an authorization decision.
    """
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"))
    sku: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    price_cents: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(100))
    allergen_tags: Mapped[dict] = mapped_column(JSON, default=dict)
    stock_qty: Mapped[int] = mapped_column(Integer)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    market_query: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    merchandising_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # True when merchandising_note is a simulated attack (shown only in the attack scenario).
    note_is_simulated_attack: Mapped[bool] = mapped_column(Boolean, default=False)
    # [{"author", "rating", "text", "simulated_attack": bool}]
    reviews: Mapped[list] = mapped_column(JSON, default=list)
    quarantined: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    merchant: Mapped["Merchant"] = relationship(back_populates="products")


class Mandate(Base):
    __tablename__ = "mandates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mandate_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    principal_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    agent_id: Mapped[str] = mapped_column(String(50))
    status: Mapped[MandateStatus] = mapped_column(Enum(MandateStatus), default=MandateStatus.pending_approval)
    instruction_text: Mapped[str] = mapped_column(Text)
    merchant_allowlist: Mapped[list] = mapped_column(JSON)
    allowed_categories: Mapped[list] = mapped_column(JSON)
    hard_constraints: Mapped[dict] = mapped_column(JSON)
    max_unit_price_cents: Mapped[int] = mapped_column(Integer)
    max_qty_per_sku: Mapped[int] = mapped_column(Integer)
    hold_cents: Mapped[int] = mapped_column(Integer)
    captured_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    purpose: Mapped[str] = mapped_column(String(300))
    expiry: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    signature: Mapped[str] = mapped_column(String(200))
    paypal_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    approve_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    authorization_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authorization_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    authorization_expires_at: Mapped[str | None] = mapped_column(String(50), nullable=True)


class CartProposal(Base):
    __tablename__ = "cart_proposals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mandate_id: Mapped[str] = mapped_column(ForeignKey("mandates.mandate_id"), index=True)
    nonce: Mapped[str] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    scenario: Mapped[str] = mapped_column(String(20), default="clean")
    status: Mapped[CartStatus] = mapped_column(Enum(CartStatus), default=CartStatus.proposed)
    proposed_total_cents: Mapped[int] = mapped_column(Integer, default=0)
    approved_total_cents: Mapped[int] = mapped_column(Integer, default=0)
    captured_cents: Mapped[int] = mapped_column(Integer, default=0)
    released_cents: Mapped[int] = mapped_column(Integer, default=0)
    capture_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    capture_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    authorization_status_after: Mapped[str | None] = mapped_column(String(50), nullable=True)
    agent_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    agent_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_transcript: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    lines: Mapped[list["CartLine"]] = relationship(back_populates="cart", order_by="CartLine.position")
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_cart_proposals_idempotency_key"),)


class CartLine(Base):
    __tablename__ = "cart_lines"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cart_id: Mapped[int] = mapped_column(ForeignKey("cart_proposals.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    sku: Mapped[str] = mapped_column(String(50))
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    qty: Mapped[int] = mapped_column(Integer)
    unit_price_cents: Mapped[int] = mapped_column(Integer, default=0)
    line_total_cents: Mapped[int] = mapped_column(Integer, default=0)
    agent_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    deterministic_decision: Mapped[Decision] = mapped_column(Enum(Decision))
    deterministic_rule: Mapped[str | None] = mapped_column(String(100), nullable=True)
    evaluator_decision: Mapped[Decision] = mapped_column(Enum(Decision))
    evaluator_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_decision: Mapped[Decision] = mapped_column(Enum(Decision))
    final_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cart: Mapped["CartProposal"] = relationship(back_populates="lines")


class AuditLog(Base):
    """
    Append-only, hash-chained: entry_hash = sha256(prev_hash + canonical
    entry). Tamper-evident, not proof of intent — see README "Honest limits".
    """
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mandate_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    cart_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType))
    actor: Mapped[str] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(50))
    decision: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rule_fired: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reason_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    prev_hash: Mapped[str] = mapped_column(String(64))
    entry_hash: Mapped[str] = mapped_column(String(64), unique=True)


def get_engine(db_url: str = "sqlite:///./leash.db"):
    return create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})


def get_session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db(engine):
    Base.metadata.create_all(engine)
