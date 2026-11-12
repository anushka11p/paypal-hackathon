import { useState } from "react";
import { Loader2 } from "lucide-react";
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

export function StepNum({ n }) {
  return <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-ink text-base font-normal tracking-normal text-canvas">{n}</span>;
}

/** `big` is for page sections (large, bold); panels inside the demo use the default. */
export function PanelHead({ title, step, aside, big, children }) {
  return (
    <header className={`flex items-start justify-between gap-4 ${big ? "mb-8" : "mb-5"}`}>
      <div className="min-w-0">
        <h3 className={`flex items-center gap-3 ${big ? "text-[32px] font-bold leading-tight tracking-[-0.03em] sm:text-[44px]" : "text-[22px] font-semibold tracking-[-0.015em]"}`}>
          {step && <StepNum n={step} />}
          {title}
        </h3>
        {children && <p className={big ? "mt-3 max-w-[58ch] text-xl leading-relaxed text-ink-2" : "mt-1.5 text-[15px] leading-relaxed text-ink-2"}>{children}</p>}
      </div>
      {aside}
    </header>
  );
}

function RuleRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-[15px] text-ink-3">{label}</dt>
      <dd className="flex flex-wrap justify-end gap-1.5 text-right text-base font-medium">{children}</dd>
    </div>
  );
}

function RuleSet({ policy }) {
  return (
    <dl className="animate-rise">
      <RuleRow label="Budget"><span className="num text-base text-accent">{usd(policy.budget_cents)}</span></RuleRow>
      <RuleRow label="Most for one item"><span className="num">{usd(policy.max_unit_price_cents)}</span></RuleRow>
      <RuleRow label="Most of each item"><span className="num">{policy.max_qty_per_sku}</span></RuleRow>
      <RuleRow label="Can buy">{policy.allowed_categories.map(titleCase).join(", ")}</RuleRow>
      <RuleRow label="Never anything with">
        {policy.excluded_allergens.length ? <span className="text-warn">{policy.excluded_allergens.join(", ")}</span> : <span className="text-ink-3">Nothing</span>}
      </RuleRow>
      <RuleRow label="Anything else"><span className="text-ink-2">Refused</span></RuleRow>
    </dl>
  );
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ on, onClick, tone = "ink", children }) {
  const active = tone === "warn" ? "border-warn text-warn" : "border-ink text-ink";
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? active : "border-line text-ink-3 hover:text-ink-2"}`}>
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
        <label className="grid gap-1.5 label">Budget{money("budget_cents")}</label>
        <label className="grid gap-1.5 label">Per item{money("max_unit_price_cents")}</label>
        <label className="grid gap-1.5 label">Of each
          <input type="number" min="1" max="50" className="field num" value={policy.max_qty_per_sku}
            onChange={(e) => set("max_qty_per_sku", parseInt(e.target.value || "1", 10))} />
        </label>
      </div>
      <div className="grid gap-2"><span className="label">Can buy</span>
        <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => (
          <Chip key={c} on={policy.allowed_categories.includes(c)} onClick={() => set("allowed_categories", toggle(policy.allowed_categories, c))}>{titleCase(c)}</Chip>
        ))}</div>
      </div>
      <div className="grid gap-2"><span className="label">Never anything with</span>
        <div className="flex flex-wrap gap-1.5">{ALLERGENS.map((a) => (
          <Chip key={a} tone="warn" on={policy.excluded_allergens.includes(a)} onClick={() => set("excluded_allergens", toggle(policy.excluded_allergens, a))}>{a}</Chip>
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
      <section className="card p-6 sm:p-8">
        <PanelHead step={1} title="Your rules" aside={<span className="badge-ok">Locked in</span>}>
          “{mandate.instruction_text}”
        </PanelHead>
        <RuleSet policy={mandate.policy} />
        <details className="group mt-4 text-[13px] text-ink-3">
          <summary className="cursor-pointer list-none hover:text-ink-2">Tamper-proof signature</summary>
          <p className="num mt-1.5 break-all">{mandate.signature}</p>
        </details>
        {["pending_approval", "active"].includes(mandate.status) && (
          <button className="btn-secondary mt-4 w-full" onClick={onRevoke}>Cancel and give the money back</button>
        )}
      </section>
    );
  }

  return (
    <section className="card p-6 sm:p-8">
      <PanelHead step={1} title="Set your rules">Say what your AI may buy, in your own words. Leash turns it into strict rules your AI can’t see or change.</PanelHead>
      <p className="mb-2 text-sm text-ink-3">Start from an example</p>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Chip key={p.label} on={text === p.text} onClick={() => { setText(p.text); setPolicy(null); setQuestion(null); }}>{p.label}</Chip>
        ))}
      </div>
      <textarea className="field min-h-24 resize-y leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} aria-label="Your rules, in plain English" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={policy ? "btn-secondary" : "btn-primary"} onClick={compile} disabled={busy || !text.trim()}>
          {busy === "compile" && <Loader2 className="size-4 animate-spin" />}
          {busy === "compile" ? "Reading your rules" : policy ? "Update the rules" : "Turn into rules"}
        </button>
        {compilerDown && <button className="btn-secondary" onClick={() => { setPolicy(MANUAL_POLICY); setError(null); }}>Fill rules by hand</button>}
      </div>

      {question && <p className="mt-4 rounded-xl bg-warn-soft px-3.5 py-3 text-base text-warn">One thing first: {question}</p>}
      {error && <p className="mt-4 rounded-xl bg-bad-soft px-3.5 py-3 text-base text-bad">{error}</p>}

      {policy && (
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[15px] font-medium text-ink-2">Rules Leash will enforce</span>
            <button className="btn-quiet !px-2 !py-1 text-sm" onClick={() => setEditing((v) => !v)}>
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          {editing ? <PolicyEditor policy={policy} onChange={setPolicy} /> : <RuleSet policy={policy} />}
          <h4 className="mt-7 flex items-center gap-3 text-[22px] font-semibold tracking-[-0.015em]"><StepNum n={2} />Hold the money</h4>
          <button className="btn-primary mt-3 w-full py-3" onClick={approve} disabled={busy}>
            {busy === "approve" && <Loader2 className="size-4 animate-spin" />}
            Hold <span className="num">{usd(policy.budget_cents)}</span> with PayPal
          </button>
          <p className="mt-2.5 text-center text-[15px] text-ink-2">Like a hotel deposit: the money is set aside, not spent.</p>
        </div>
      )}
    </section>
  );
}
