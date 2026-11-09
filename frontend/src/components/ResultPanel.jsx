import { usd } from "../api";

const RULE_LABELS = {
  approved: "Approved",
  qty_exceeds_mandate: "Quantity over your limit",
  hard_constraint_violation: "Contains an ingredient you banned",
  category_not_allowed: "Category you didn't allow",
  unit_price_exceeds_mandate: "Price over your per-item limit",
  exceeds_remaining_hold: "Doesn't fit in the remaining hold",
  evaluator_veto: "Not what you asked for (intent check)",
  unknown_sku: "Not in the merchant's catalog",
  product_quarantined: "Product quarantined",
  out_of_stock: "Out of stock",
  invalid_quantity: "Invalid quantity",
  duplicate_line: "Duplicate line",
};

function Verdict({ ok, children }) {
  return <span className={`chip ${ok ? "ok" : "bad"}`}><span className="dot" />{children}</span>;
}

function AttackSnippets({ output }) {
  if (!output) return null;
  const hits = [];
  if (output.merchant_note && /shopping assistants?|automated orders/i.test(output.merchant_note)) {
    hits.push(["Merchant note the agent read", output.merchant_note]);
  }
  for (const r of output.reviews || []) {
    if (/shopping assistant/i.test(r.text || "")) hits.push([`Review by ${r.author}`, r.text]);
  }
  return hits.map(([tag, text]) => (
    <div className="attack-text" key={tag}><span className="tag">Simulated attack · {tag}</span>{text}</div>
  ));
}

export default function ResultPanel({ cart }) {
  const blocked = cart.proposed_total_cents - cart.approved_total_cents;
  return (
    <section className="step">
      <div className="step-head">
        <h2><span className="step-num">04</span>What the agent proposed, and what Leash paid</h2>
        <span className={`chip ${cart.status === "captured" ? "ok" : cart.status === "blocked" ? "warn" : "bad"}`}>
          <span className="dot" />{cart.status}
        </span>
      </div>

      <div className="money">
        <div className="stat"><div className="label">Agent proposed</div><div className="value">{usd(cart.proposed_total_cents)}</div></div>
        <div className="stat bad"><div className="label">Blocked by Leash</div><div className="value">{usd(blocked)}</div></div>
        <div className="stat ok"><div className="label">Captured by PayPal</div><div className="value">{usd(cart.captured_cents)}</div></div>
        <div className="stat hold"><div className="label">Released from hold</div><div className="value">{usd(cart.released_cents)}</div></div>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        {cart.paypal.capture_id
          ? <>Capture <code>{cart.paypal.capture_id}</code> ({cart.paypal.capture_status}) with <code>final_capture: true</code>; authorization read back as <b>{cart.paypal.authorization_status_after}</b>.</>
          : cart.status === "blocked" ? "Nothing passed, so the whole authorization was voided." : "No capture was made."}
      </p>

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="cart">
          <thead><tr>
            <th>Item the agent chose</th><th className="num">Qty</th><th className="num">Total</th>
            <th>Hard rules</th><th>Intent check (LLM)</th><th>Result</th>
          </tr></thead>
          <tbody>
            {cart.lines.map((l) => {
              const ok = l.final.decision === "approved";
              return (
                <tr key={l.sku} className={ok ? "approved" : "rejected"}>
                  <td><b>{l.name || l.sku}</b><div className="why">Agent: “{l.agent_reason}”</div></td>
                  <td className="num">{l.qty}</td>
                  <td className="num">{usd(l.line_total_cents)}</td>
                  <td><Verdict ok={l.deterministic.decision === "approved"}>
                    {l.deterministic.decision === "approved" ? "Passed" : RULE_LABELS[l.deterministic.rule] || l.deterministic.rule}
                  </Verdict></td>
                  <td><Verdict ok={l.evaluator.decision === "approved"}>{l.evaluator.decision === "approved" ? "Consistent" : "Veto"}</Verdict>
                    <div className="why">{l.evaluator.reason}</div></td>
                  <td><b style={{ color: ok ? "var(--ok)" : "var(--bad)" }}>{ok ? "Paid" : "Blocked"}</b>
                    <div className="why">{RULE_LABELS[l.final.reason] || l.final.reason}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="transcript">
        <summary>What the agent read and did ({cart.agent.transcript.length} steps · {cart.agent.model})</summary>
        {cart.agent.transcript.map((t, i) => (
          <div className="tline" key={i}>
            {t.type === "text" ? <span>{t.text}</span> : (
              <>
                <span className="tool">{t.name}</span> <span className="muted mono">{JSON.stringify(t.input)}</span>
                <AttackSnippets output={t.output} />
              </>
            )}
          </div>
        ))}
        {cart.agent.summary && <p className="small"><b>Agent's summary:</b> {cart.agent.summary}</p>}
      </details>
    </section>
  );
}
