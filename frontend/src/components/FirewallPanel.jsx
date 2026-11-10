import { useEffect, useState } from "react";
import { ArrowRight, Brain, CheckCircle2, Cpu, Loader2, ShieldX, Undo2, XCircle } from "lucide-react";
import { usd } from "../api";

const RULE_LABELS = {
  qty_exceeds_mandate: (l, p) => `Qty ${l.qty} > max ${p.max_qty_per_sku}`,
  hard_constraint_violation: () => "Contains a banned ingredient",
  category_not_allowed: () => "Category not allowed",
  unit_price_exceeds_mandate: () => "Over the per-item price cap",
  unknown_sku: () => "Not in the merchant's catalog",
  product_quarantined: () => "Product quarantined",
  out_of_stock: () => "Out of stock",
  invalid_quantity: () => "Invalid quantity",
};
const FINAL_LABELS = {
  approved: "Sent to PayPal",
  evaluator_veto: "Vetoed: not what you asked for",
  exceeds_remaining_hold: "Doesn't fit the remaining hold",
  duplicate_line: "Duplicate line",
};

const STEP_MS = 420;

function Pending() {
  return <span className="badge-muted"><Loader2 className="size-3 animate-spin" /> checking</span>;
}

function LayerCell({ shown, ok, children, okText }) {
  if (!shown) return <Pending />;
  return ok
    ? <span className="badge-ok animate-rise"><CheckCircle2 className="size-3.5" /> {okText}</span>
    : <span className="badge-bad animate-rise"><XCircle className="size-3.5" /> {children}</span>;
}

/** Replays the engine's real decisions one stage at a time; reports the running approved total. */
export default function FirewallPanel({ cart, policy, animate, onProgress, onDone }) {
  const total = cart.lines.length * 3;
  const [stage, setStage] = useState(animate ? 0 : total);

  useEffect(() => {
    if (stage >= total) { onDone?.(); return; }
    const t = setTimeout(() => setStage((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [stage, total, onDone]);

  useEffect(() => {
    const finished = cart.lines.filter((_, i) => stage >= i * 3 + 3);
    onProgress?.(finished.filter((l) => l.final.decision === "approved").reduce((s, l) => s + l.line_total_cents, 0));
  }, [stage, cart, onProgress]);

  const complete = stage >= total;
  const blocked = cart.proposed_total_cents - cart.approved_total_cents;

  return (
    <section className="card card-pad">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Step 4 · Leash firewall</div>
          <h2 className="mt-1 text-lg font-semibold">Every line, two independent layers</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-ink-2">
          <span className="flex items-center gap-1.5"><Cpu className="size-3.5" /> Layer 1: hard rules, plain code, can't be prompted</span>
          <span className="flex items-center gap-1.5"><Brain className="size-3.5" /> Layer 2: LLM intent check, can only veto</span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.6fr_0.5fr_1.2fr_1.5fr_1fr] gap-3 border-b border-line pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            <div>Agent's proposal</div><div className="text-right">Total</div><div>Layer 1 · rules</div><div>Layer 2 · intent</div><div>Result</div>
          </div>
          {cart.lines.map((l, i) => {
            if (stage < i * 3 && animate) return null;
            const s1 = stage >= i * 3 + 1, s2 = stage >= i * 3 + 2, s3 = stage >= i * 3 + 3;
            const ok = l.final.decision === "approved";
            return (
              <div key={l.sku} className={`grid grid-cols-[1.6fr_0.5fr_1.2fr_1.5fr_1fr] items-start gap-3 border-b border-line py-3.5 animate-rise ${s3 ? (ok ? "bg-ok-soft/40" : "bg-bad-soft/40") : ""}`}>
                <div className="min-w-0 pl-1">
                  <div className="text-sm font-semibold">{l.qty}× {l.name || l.sku}</div>
                  <div className="mt-0.5 text-xs text-ink-3">“{l.agent_reason}”</div>
                </div>
                <div className="text-right text-sm font-semibold tabular-nums">{usd(l.line_total_cents)}</div>
                <div><LayerCell shown={s1} ok={l.deterministic.decision === "approved"} okText="Passed">
                  {(RULE_LABELS[l.deterministic.rule] || (() => l.deterministic.rule))(l, policy)}</LayerCell></div>
                <div>
                  <LayerCell shown={s2} ok={l.evaluator.decision === "approved"} okText="Consistent">Veto</LayerCell>
                  {s2 && <div className="mt-1 text-xs text-ink-3">{l.evaluator.reason}</div>}
                </div>
                <div>{s3 ? (ok
                  ? <span className="flex items-center gap-1 text-sm font-semibold text-ok-ink animate-rise"><ArrowRight className="size-4" /> {FINAL_LABELS.approved}</span>
                  : <span className="flex items-start gap-1 text-sm font-semibold text-bad-ink animate-rise"><ShieldX className="mt-0.5 size-4 shrink-0" /> {FINAL_LABELS[l.final.reason] || RULE_LABELS[l.final.reason]?.(l, policy) || "Blocked"}</span>)
                  : <span className="text-xs text-ink-3">—</span>}</div>
              </div>
            );
          })}
        </div>
      </div>

      {complete && (
        <div className="mt-5 grid gap-3 sm:grid-cols-4 animate-rise">
          <div className="rounded-xl border border-line p-4"><div className="eyebrow">Agent proposed</div><div className="mt-1 text-2xl font-semibold tabular-nums">{usd(cart.proposed_total_cents)}</div></div>
          <div className="rounded-xl border border-bad/30 bg-bad-soft p-4"><div className="eyebrow !text-bad-ink">Blocked by Leash</div><div className="mt-1 text-2xl font-semibold tabular-nums text-bad-ink">{usd(blocked)}</div></div>
          <div className="rounded-xl border border-ok/30 bg-ok-soft p-4"><div className="eyebrow !text-ok-ink">Step 5 · Captured</div><div className="mt-1 text-2xl font-semibold tabular-nums text-ok-ink">{usd(cart.captured_cents)}</div></div>
          <div className="rounded-xl border border-hold/30 bg-hold-soft p-4"><div className="eyebrow !text-hold">Released to you</div><div className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums text-hold"><Undo2 className="size-5" />{usd(cart.released_cents)}</div></div>
          <p className="text-xs text-ink-3 sm:col-span-4">
            {cart.paypal.capture_id
              ? <>PayPal capture <code className="font-mono">{cart.paypal.capture_id}</code> · {cart.paypal.capture_status} · <code className="font-mono">final_capture: true</code> released the rest · authorization read back as <b>{cart.paypal.authorization_status_after}</b>.</>
              : cart.status === "blocked" ? "Nothing passed, so the whole authorization was voided." : "No capture was made."}
          </p>
        </div>
      )}
    </section>
  );
}
