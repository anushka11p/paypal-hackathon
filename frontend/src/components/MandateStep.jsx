import { useState } from "react";
import { api, usd } from "../api";

const CATEGORIES = ["pet_food", "pet_treats", "pet_supplements", "pet_toys", "pet_accessories"];
const ALLERGENS = ["chicken", "beef", "lamb", "fish", "dairy", "egg", "wheat", "soy", "corn", "peanut"];

export const DEMO_MANDATE =
  "Dog food and treats for Bramble, up to $80 total, no more than 2 of any item, and never anything with chicken — she's allergic.";

const DEMO_POLICY = {
  budget_cents: 8000, max_unit_price_cents: 8000, max_qty_per_sku: 2,
  allowed_categories: ["pet_food", "pet_treats"], excluded_allergens: ["chicken"],
  purpose: "Dog food and treats for Bramble",
};

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function MandateStep() {
  const [text, setText] = useState(DEMO_MANDATE);
  const [policy, setPolicy] = useState(null);
  const [question, setQuestion] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [compilerDown, setCompilerDown] = useState(false);

  async function compile() {
    setBusy("compile"); setError(null); setQuestion(null);
    try {
      const res = await api.compile(text);
      if (res.needs_clarification) { setPolicy(null); setQuestion(res.question); }
      else setPolicy(res.policy);
    } catch (e) {
      setError(e.message);
      setCompilerDown(e.status === 503);
    } finally { setBusy(null); }
  }

  async function approve() {
    setBusy("approve"); setError(null);
    try {
      const mandate = await api.createMandate(text, policy);
      window.location.href = mandate.paypal.approve_url;
    } catch (e) { setError(e.message); setBusy(null); }
  }

  const set = (key, value) => setPolicy((p) => ({ ...p, [key]: value }));
  const dollars = (key) => (
    <input type="number" min="0.01" step="0.01" value={(policy[key] / 100).toFixed(2)}
      onChange={(e) => set(key, Math.round(parseFloat(e.target.value || "0") * 100))} />
  );

  return (
    <section className="step">
      <div className="step-head">
        <h2><span className="step-num">01</span>Set the leash</h2>
        <span className="muted small">Plain English in. Strict rules out. You check them before anything is held.</span>
      </div>

      <label className="field">Your mandate
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={compile} disabled={busy || !text.trim()}>
          {busy === "compile" ? <><span className="spinner" /> Compiling with Claude…</> : "Compile into rules"}
        </button>
        {compilerDown && (
          <button className="btn ghost" onClick={() => { setPolicy(DEMO_POLICY); setError(null); }}>
            Fill rules by hand instead
          </button>
        )}
      </div>

      {question && <p className="note" style={{ marginTop: 14 }}>Leash needs one thing first: {question}</p>}
      {error && <p className="error" style={{ marginTop: 14 }}>{error}</p>}

      {policy && (
        <div style={{ marginTop: 20 }}>
          <div className="grid-2">
            <label className="field">Total budget (becomes the PayPal hold){dollars("budget_cents")}</label>
            <label className="field">Max price per item{dollars("max_unit_price_cents")}</label>
            <label className="field">Max quantity of any item
              <input type="number" min="1" max="50" value={policy.max_qty_per_sku}
                onChange={(e) => set("max_qty_per_sku", parseInt(e.target.value || "1", 10))} />
            </label>
            <label className="field">Purpose
              <input type="text" value={policy.purpose} onChange={(e) => set("purpose", e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: 16 }} className="field">Allowed categories
            <div className="pills">{CATEGORIES.map((c) => (
              <button key={c} className={`pill ${policy.allowed_categories.includes(c) ? "on" : ""}`}
                onClick={() => set("allowed_categories", toggle(policy.allowed_categories, c))}>{c.replace("pet_", "")}</button>
            ))}</div>
          </div>
          <div style={{ marginTop: 12 }} className="field">Never buy anything containing
            <div className="pills">{ALLERGENS.map((a) => (
              <button key={a} className={`pill ${policy.excluded_allergens.includes(a) ? "on" : ""}`}
                onClick={() => set("excluded_allergens", toggle(policy.excluded_allergens, a))}>{a}</button>
            ))}</div>
          </div>
          <div className="row" style={{ marginTop: 20, justifyContent: "space-between" }}>
            <span className="muted small">Unknown categories are rejected. The agent never sees these rules — the wallet enforces them.</span>
            <button className="btn" onClick={approve} disabled={busy}>
              {busy === "approve" ? <><span className="spinner" /> Creating hold…</> : `Approve ${usd(policy.budget_cents)} hold in PayPal`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
