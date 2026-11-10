import { useState } from "react";
import { Loader2, Lock, PencilLine, Sparkles } from "lucide-react";
import { api, titleCase, usd } from "../api";

const CATEGORIES = ["pet_food", "pet_treats", "pet_supplements", "pet_toys", "pet_accessories"];
const ALLERGENS = ["chicken", "beef", "lamb", "fish", "dairy", "egg", "wheat", "soy", "corn", "peanut"];

const PRESETS = [
  { label: "Food & treats", text: "Dog food and treats, up to $80, max 2 of anything, never chicken (my dog is allergic)." },
  { label: "Treats only", text: "Just dog treats and chews, up to $30 total, no more than 2 of each, no chicken or beef." },
  { label: "Strict restock", text: "Only dog food, up to $50, one bag maximum, nothing containing chicken." },
];

const MANUAL_POLICY = {
  budget_cents: 8000, max_unit_price_cents: 8000, max_qty_per_sku: 2,
  allowed_categories: ["pet_food", "pet_treats"], excluded_allergens: ["chicken"], purpose: "Dog food and treats",
};

export function PanelHead({ step, title, aside, children }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          {step && <span className="num flex size-5 items-center justify-center rounded-full bg-surface-2 text-[11px] text-ink-2">{step}</span>}
          {title}
        </h3>
        {children && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{children}</p>}
      </div>
      {aside}
    </header>
  );
}

function RuleRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="flex flex-wrap justify-end gap-1.5 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function RuleSet({ policy }) {
  return (
    <dl className="animate-rise">
      <RuleRow label="PayPal hold"><span className="num text-base text-accent">{usd(policy.budget_cents)}</span></RuleRow>
      <RuleRow label="Max per item"><span className="num">{usd(policy.max_unit_price_cents)}</span></RuleRow>
      <RuleRow label="Max quantity"><span className="num">{policy.max_qty_per_sku}</span></RuleRow>
      <RuleRow label="Allowed">{policy.allowed_categories.map((c) => <span key={c} className="badge-muted">{titleCase(c)}</span>)}</RuleRow>
      <RuleRow label="Never contains">
        {policy.excluded_allergens.length ? policy.excluded_allergens.map((a) => <span key={a} className="badge-bad">{a}</span>) : <span className="text-ink-3">Nothing</span>}
      </RuleRow>
      <RuleRow label="Anything else"><span className="text-ink-2">Rejected</span></RuleRow>
    </dl>
  );
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ on, onClick, tone = "ink", children }) {
  const active = tone === "bad" ? "bg-bad text-canvas border-bad" : "bg-ink text-canvas border-ink";
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? active : "border-line-strong text-ink-2 hover:bg-surface-2"}`}>
      {children}
    </button>
  );
}

function PolicyEditor({ policy, onChange }) {
  const set = (k, v) => onChange({ ...policy, [k]: v });
  const money = (k) => (
    <input type="number" min="0.01" step="0.01" className="field num" value={(policy[k] / 100).toFixed(2)}
      onChange={(e) => set(k, Math.round(parseFloat(e.target.value || "0") * 100))} />
  );
  return (
    <div className="grid gap-4 animate-rise">
      <div className="grid grid-cols-3 gap-2.5">
        <label className="grid gap-1.5 label">Hold{money("budget_cents")}</label>
        <label className="grid gap-1.5 label">Per item{money("max_unit_price_cents")}</label>
        <label className="grid gap-1.5 label">Max qty
          <input type="number" min="1" max="50" className="field num" value={policy.max_qty_per_sku}
            onChange={(e) => set("max_qty_per_sku", parseInt(e.target.value || "1", 10))} />
        </label>
      </div>
      <div className="grid gap-2"><span className="label">Allowed categories</span>
        <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => (
          <Chip key={c} on={policy.allowed_categories.includes(c)} onClick={() => set("allowed_categories", toggle(policy.allowed_categories, c))}>{titleCase(c)}</Chip>
        ))}</div>
      </div>
      <div className="grid gap-2"><span className="label">Never contains</span>
        <div className="flex flex-wrap gap-1.5">{ALLERGENS.map((a) => (
          <Chip key={a} tone="bad" on={policy.excluded_allergens.includes(a)} onClick={() => set("excluded_allergens", toggle(policy.excluded_allergens, a))}>{a}</Chip>
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
      <section className="card p-5 sm:p-6">
        <PanelHead step="1" title="Your mandate" aside={<span className="badge-ok"><Lock className="size-3" /> Signed</span>}>
          “{mandate.instruction_text}”
        </PanelHead>
        <RuleSet policy={mandate.policy} />
        <p className="num mt-4 truncate text-[11px] text-ink-3" title={mandate.signature}>{mandate.signature}</p>
        {["pending_approval", "active"].includes(mandate.status) && (
          <button className="btn-secondary mt-4 w-full" onClick={onRevoke}>Revoke and release the hold</button>
        )}
      </section>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <PanelHead step="1" title="Write the mandate">Plain English in. Strict rules out. The agent never sees them.</PanelHead>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Chip key={p.label} on={text === p.text} onClick={() => { setText(p.text); setPolicy(null); setQuestion(null); }}>{p.label}</Chip>
        ))}
      </div>
      <textarea className="field min-h-24 resize-y leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} aria-label="Mandate" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={policy ? "btn-secondary" : "btn-primary"} onClick={compile} disabled={busy || !text.trim()}>
          {busy === "compile" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy === "compile" ? "Compiling" : policy ? "Recompile" : "Compile into rules"}
        </button>
        {compilerDown && <button className="btn-secondary" onClick={() => { setPolicy(MANUAL_POLICY); setError(null); }}>Fill rules by hand</button>}
      </div>

      {question && <p className="mt-4 rounded-xl bg-warn-soft px-3.5 py-3 text-sm text-warn">One thing first: {question}</p>}
      {error && <p className="mt-4 rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{error}</p>}

      {policy && (
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-2">Compiled rules</span>
            <button className="btn-quiet !px-2 !py-1 text-xs" onClick={() => setEditing((v) => !v)}>
              <PencilLine className="size-3.5" /> {editing ? "Done" : "Edit"}
            </button>
          </div>
          {editing ? <PolicyEditor policy={policy} onChange={setPolicy} /> : <RuleSet policy={policy} />}
          <button className="btn-primary mt-5 w-full py-3" onClick={approve} disabled={busy}>
            {busy === "approve" && <Loader2 className="size-4 animate-spin" />}
            Authorize <span className="num">{usd(policy.budget_cents)}</span> hold with PayPal
          </button>
          <p className="mt-2 text-center text-xs text-ink-3">A hold, not a charge. Nothing is captured until Leash approves items.</p>
        </div>
      )}
    </section>
  );
}
