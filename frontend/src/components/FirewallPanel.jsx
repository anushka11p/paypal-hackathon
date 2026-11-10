import { useEffect, useState } from "react";
import { Brain, CircleCheck, CircleX, Cpu, Loader2 } from "lucide-react";
import { usd } from "../api";
import { PanelHead } from "./MandatePanel";
import HoldObject from "./HoldObject";

const RULE_LABELS = {
  qty_exceeds_mandate: (l, p) => `Quantity ${l.qty} is over the limit of ${p.max_qty_per_sku}`,
  hard_constraint_violation: () => "Contains a banned ingredient",
  category_not_allowed: () => "Category not allowed",
  unit_price_exceeds_mandate: () => "Over the per-item price cap",
  unknown_sku: () => "Not in the merchant's catalog",
  product_quarantined: () => "Product quarantined",
  out_of_stock: () => "Out of stock",
  invalid_quantity: () => "Invalid quantity",
};
const FINAL_LABELS = {
  approved: "Captured",
  evaluator_veto: "Not what you asked for",
  exceeds_remaining_hold: "Doesn't fit the hold",
  duplicate_line: "Duplicate line",
};

const STEP_MS = 420;
const GRID = "grid grid-cols-[minmax(0,1.7fr)_5.5rem_minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.9fr)] gap-4";

function Verdict({ shown, ok, okText, children }) {
  if (!shown) return <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><Loader2 className="size-3 animate-spin" /> checking</span>;
  return ok
    ? <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok animate-rise"><CircleCheck className="size-4" /> {okText}</span>
    : <span className="inline-flex items-start gap-1.5 text-[13px] font-medium text-bad animate-rise"><CircleX className="mt-[1px] size-4 shrink-0" /> {children}</span>;
}

/** Replays the engine's real decisions one stage at a time; reports the running approved total. */
export default function FirewallPanel({ cart, policy, theme, animate, onProgress, onDone }) {
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
    <section className="border-t border-line pt-6">
      <PanelHead title="Leash checks every line"
        aside={
          <div className="hidden shrink-0 gap-4 text-xs text-ink-3 md:flex">
            <span className="flex items-center gap-1.5"><Cpu className="size-3.5" /> Rules: plain code, can't be prompted</span>
            <span className="flex items-center gap-1.5"><Brain className="size-3.5" /> Intent: an LLM that can only veto</span>
          </div>
        }>
        Both layers see every item. Either can block it; neither can approve it alone.
      </PanelHead>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-[780px]">
          <div className={`${GRID} border-b border-line pb-2 text-xs text-ink-3`}>
            <div>Agent proposed</div><div className="text-right">Amount</div><div>Rules</div><div>Intent</div><div>Result</div>
          </div>
          {cart.lines.map((l, i) => {
            if (animate && stage < i * 3) return null;
            const s1 = stage >= i * 3 + 1, s2 = stage >= i * 3 + 2, s3 = stage >= i * 3 + 3;
            const ok = l.final.decision === "approved";
            return (
              <div key={l.sku} className={`${GRID} items-start border-b border-line py-3.5 animate-rise last:border-0`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium"><span className="num text-ink-2">{l.qty} ×</span> {l.name || l.sku}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-3">“{l.agent_reason}”</div>
                </div>
                <div className={`num text-right text-sm ${s3 && !ok ? "text-ink-3 line-through decoration-bad/60" : ""}`}>{usd(l.line_total_cents)}</div>
                <div><Verdict shown={s1} ok={l.deterministic.decision === "approved"} okText="Passed">
                  {(RULE_LABELS[l.deterministic.rule] || (() => l.deterministic.rule))(l, policy)}</Verdict></div>
                <div>
                  <Verdict shown={s2} ok={l.evaluator.decision === "approved"} okText="Matches the request">Vetoed</Verdict>
                  {s2 && <p className="mt-1 text-xs leading-relaxed text-ink-3">{l.evaluator.reason}</p>}
                </div>
                <div className="text-[13px] font-medium">{s3
                  ? <span className={`${ok ? "text-ok" : "text-bad"} animate-rise`}>{FINAL_LABELS[l.final.reason] || RULE_LABELS[l.final.reason]?.(l, policy) || "Blocked"}</span>
                  : <span className="text-ink-3">·</span>}</div>
              </div>
            );
          })}
        </div>
      </div>

      {complete && (
        <div className="mt-2 grid items-center gap-x-8 gap-y-4 border-t border-line-strong pt-5 animate-rise md:grid-cols-[1fr_200px]">
          <div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm">
            <span className="text-ink-2">Proposed <span className="num ml-1 text-ink">{usd(cart.proposed_total_cents)}</span></span>
            <span className="text-ink-3">−</span>
            <span className="text-ink-2">Blocked <span className="num ml-1 text-bad">{usd(blocked)}</span></span>
            <span className="text-ink-3">=</span>
            <span className="text-ink-2">Captured <span className="num ml-1 text-2xl text-ok">{usd(cart.captured_cents)}</span></span>
            <span className="text-ink-2 sm:ml-auto">Released to you <span className="num ml-1 text-2xl text-accent">{usd(cart.released_cents)}</span></span>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {cart.paypal.capture_id
              ? <>PayPal capture <span className="num">{cart.paypal.capture_id}</span> {cart.paypal.capture_status?.toLowerCase()} with final_capture, which released the rest. Authorization read back as {cart.paypal.authorization_status_after}.</>
              : cart.status === "blocked" ? "Nothing passed, so the whole authorization was voided." : "No capture was made."}
          </p>
          </div>
          <HoldObject theme={theme} mode="settle" className="order-first mx-auto aspect-square w-40 md:order-none md:w-[200px]"
            releasedCoins={Math.round((cart.released_cents / Math.max(1, cart.captured_cents + cart.released_cents)) * 8)}
            label={`Settled: ${usd(cart.captured_cents)} captured stays in the strap, ${usd(cart.released_cents)} released lifts out.`} />
        </div>
      )}
    </section>
  );
}
