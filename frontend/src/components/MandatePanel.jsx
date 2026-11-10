import { useState } from "react";
import { Ban, FileSignature, Hash, Layers, Loader2, Lock, PencilLine, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { api, titleCase, usd } from "../api";

const CATEGORIES = ["pet_food", "pet_treats", "pet_supplements", "pet_toys", "pet_accessories"];
const ALLERGENS = ["chicken", "beef", "lamb", "fish", "dairy", "egg", "wheat", "soy", "corn", "peanut"];

const PRESETS = [
  { label: "Dog food & treats", text: "Dog food and treats, up to $80, max 2 of anything, never chicken (my dog is allergic)." },
  { label: "Treats only", text: "Just dog treats and chews, up to $30 total, no more than 2 of each, no chicken or beef." },
  { label: "Strict restock", text: "Only dog food, up to $50, one bag maximum, nothing containing chicken." },
];

const MANUAL_POLICY = {
  budget_cents: 8000, max_unit_price_cents: 8000, max_qty_per_sku: 2,
  allowed_categories: ["pet_food", "pet_treats"], excluded_allergens: ["chicken"], purpose: "Dog food and treats",
};

function Rule({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas/60 px-3.5 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
      <div className="min-w-0">
        <div className="eyebrow">{label}</div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-sm font-semibold">{children}</div>
      </div>
    </div>
  );
}

function RuleSet({ policy }) {
  return (
    <div className="grid gap-2.5 animate-rise">
      <Rule icon={Layers} label="Allowed categories">
        {policy.allowed_categories.map((c) => <span key={c} className="badge-ok">{titleCase(c)}</span>)}
      </Rule>
      <div className="grid grid-cols-2 gap-2.5">
        <Rule icon={Wallet} label="Max budget · PayPal hold"><span className="text-lg tabular-nums">{usd(policy.budget_cents)}</span></Rule>
        <Rule icon={Hash} label="Max qty per item"><span className="text-lg tabular-nums">{policy.max_qty_per_sku}</span></Rule>
      </div>
      <Rule icon={Ban} label="Banned ingredients">
        {policy.excluded_allergens.length
          ? policy.excluded_allergens.map((a) => <span key={a} className="badge-bad">{a}</span>)
          : <span className="text-ink-3">None</span>}
      </Rule>
      <div className="flex items-center gap-2 text-xs text-ink-3">
        <ShieldCheck className="size-3.5" aria-hidden /> Unknown categories are rejected · max {usd(policy.max_unit_price_cents)} per item
      </div>
    </div>
  );
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function PolicyEditor({ policy, onChange }) {
  const set = (k, v) => onChange({ ...policy, [k]: v });
  const money = (k) => (
    <input type="number" min="0.01" step="0.01" className="field" value={(policy[k] / 100).toFixed(2)}
      onChange={(e) => set(k, Math.round(parseFloat(e.target.value || "0") * 100))} />
  );
  return (
    <div className="grid gap-3 animate-rise">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Budget (PayPal hold){money("budget_cents")}</label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Max per item{money("max_unit_price_cents")}</label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Max qty per item
          <input type="number" min="1" max="50" className="field" value={policy.max_qty_per_sku}
            onChange={(e) => set("max_qty_per_sku", parseInt(e.target.value || "1", 10))} />
        </label>
      </div>
      <div className="grid gap-1.5 text-xs font-semibold text-ink-2">Allowed categories
        <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => set("allowed_categories", toggle(policy.allowed_categories, c))}
            className={policy.allowed_categories.includes(c) ? "badge bg-blush text-canvas" : "badge-muted"}>{titleCase(c)}</button>
        ))}</div>
      </div>
      <div className="grid gap-1.5 text-xs font-semibold text-ink-2">Banned ingredients
        <div className="flex flex-wrap gap-1.5">{ALLERGENS.map((a) => (
          <button key={a} type="button" onClick={() => set("excluded_allergens", toggle(policy.excluded_allergens, a))}
            className={policy.excluded_allergens.includes(a) ? "badge bg-bad text-white" : "badge-muted"}>{a}</button>
        ))}</div>
      </div>
    </div>
  );
}

export default function MandatePanel({ mandate, onRevoke }) {
  const [text, setText] = useState(PRESETS[0].text);
  const [policy, setPolicy] = useState(null);
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [compilerDown, setCompilerDown] = useState(false);

  async function compile() {
    setBusy("compile"); setError(null); setQuestion(null); setEditing(false);
    try {
      const res = await api.compile(text);
      if (res.needs_clarification) { setPolicy(null); setQuestion(res.question); }
      else setPolicy(res.policy);
    } catch (e) { setError(e.message); setCompilerDown(e.status === 503); }
    finally { setBusy(null); }
  }

  async function approve() {
    setBusy("approve"); setError(null);
    try {
      const created = await api.createMandate(text, policy);
      window.location.href = created.paypal.approve_url;
    } catch (e) { setError(e.message); setBusy(null); }
  }

  if (mandate) {
    return (
      <section className="card card-pad">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div><div className="eyebrow">Step 1 · Mandate</div><h2 className="mt-1 text-lg font-semibold">Your rules, signed</h2></div>
          <Lock className="size-5 text-ok" aria-label="Locked" />
        </header>
        <p className="mb-4 rounded-xl bg-canvas px-3.5 py-3 text-sm text-ink-2">“{mandate.instruction_text}”</p>
        <RuleSet policy={mandate.policy} />
        <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-ink-3">
          <FileSignature className="size-3.5" aria-hidden /> {mandate.signature.slice(0, 26)}…
        </div>
        {["pending_approval", "active"].includes(mandate.status) && (
          <button className="btn-ghost mt-4 w-full" onClick={onRevoke}>Revoke mandate & release hold</button>
        )}
      </section>
    );
  }

  return (
    <section className="card card-pad">
      <header className="mb-4">
        <div className="eyebrow">Step 1 · Mandate</div>
        <h2 className="mt-1 text-lg font-semibold">Set the leash in plain English</h2>
      </header>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => { setText(p.text); setPolicy(null); setQuestion(null); }}
            className={text === p.text ? "badge bg-blush text-canvas" : "badge-muted hover:bg-surface-2"}>{p.label}</button>
        ))}
      </div>
      <textarea className="field min-h-24 resize-y leading-relaxed" value={text} onChange={(e) => setText(e.target.value)}
        aria-label="Mandate" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={compile} disabled={busy || !text.trim()}>
          {busy === "compile" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy === "compile" ? "Compiling…" : "Compile mandate"}
        </button>
        {compilerDown && <button className="btn-ghost" onClick={() => { setPolicy(MANUAL_POLICY); setError(null); }}>Fill rules by hand</button>}
      </div>

      {question && <p className="mt-4 rounded-xl bg-warn-soft px-3.5 py-3 text-sm text-warn-ink">Leash needs one thing first: {question}</p>}
      {error && <p className="mt-4 rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad-ink">{error}</p>}

      {policy && (
        <div className="mt-5 border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="eyebrow">Compiled rules</span>
            <button className="flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink" onClick={() => setEditing((v) => !v)}>
              <PencilLine className="size-3.5" /> {editing ? "Done" : "Edit"}
            </button>
          </div>
          {editing ? <PolicyEditor policy={policy} onChange={setPolicy} /> : <RuleSet policy={policy} />}
          <button className="btn-paypal mt-5 w-full py-3" onClick={approve} disabled={busy}>
            {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            Authorize {usd(policy.budget_cents)} hold with PayPal
          </button>
          <p className="mt-2 text-center text-xs text-ink-3">A hold, not a charge. The agent never sees these rules.</p>
        </div>
      )}
    </section>
  );
}
