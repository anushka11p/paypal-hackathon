import { usd } from "../api";

const STATUS = {
  pending_approval: ["warn", "Waiting for your PayPal approval"],
  active: ["hold", "Hold placed — agent may shop"],
  settled: ["ok", "Settled"],
  revoked: ["bad", "Revoked — hold released"],
  expired: ["bad", "Expired"],
};

export default function HoldCard({ mandate, onRevoke }) {
  const [tone, label] = STATUS[mandate.status] || ["", mandate.status];
  const p = mandate.policy;
  return (
    <section className="step">
      <div className="step-head">
        <h2><span className="step-num">02</span>Your budget, held by PayPal</h2>
        <span className={`chip ${tone}`}><span className="dot" />{label}</span>
      </div>
      <div className="money">
        <div className="stat hold"><div className="label">Authorization hold</div><div className="value">{usd(mandate.hold_cents)}</div></div>
        <div className="stat"><div className="label">Max per item</div><div className="value">{usd(p.max_unit_price_cents)}</div></div>
        <div className="stat"><div className="label">Max qty per item</div><div className="value">{p.max_qty_per_sku}</div></div>
        <div className="stat"><div className="label">Never contains</div><div className="value" style={{ fontSize: 18, paddingTop: 6 }}>{p.excluded_allergens.join(", ") || "—"}</div></div>
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>
        “{mandate.instruction_text}” · categories: {p.allowed_categories.map((c) => c.replace("pet_", "")).join(", ")}
      </p>
      <div className="row small muted" style={{ marginTop: 6 }}>
        <span>Order <code>{mandate.paypal.order_id}</code></span>
        {mandate.paypal.authorization_id && <span>Authorization <code>{mandate.paypal.authorization_id}</code> ({mandate.paypal.authorization_status})</span>}
        {mandate.paypal.authorization_expires_at && <span>expires {new Date(mandate.paypal.authorization_expires_at).toLocaleDateString()}</span>}
        <span>Signature <code>{mandate.signature.slice(0, 18)}…</code></span>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        {mandate.status === "pending_approval" && mandate.paypal.approve_url && (
          <a className="btn" href={mandate.paypal.approve_url}>Open PayPal approval</a>
        )}
        {["pending_approval", "active"].includes(mandate.status) && (
          <button className="btn ghost sm" onClick={onRevoke}>Revoke and release hold</button>
        )}
      </div>
    </section>
  );
}
