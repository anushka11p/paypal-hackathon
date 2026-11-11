import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { usd } from "../api";
import { PanelHead } from "./MandatePanel";
import HoldObject from "./HoldObject";

const RULE_LABELS = {
  qty_exceeds_mandate: (l, p) => `${l.qty} is more than your limit of ${p.max_qty_per_sku}`,
  hard_constraint_violation: () => "Has an ingredient you banned",
  category_not_allowed: () => "Not something you allowed",
  unit_price_exceeds_mandate: () => "Costs more than your per-item limit",
  unknown_sku: () => "Not sold by this store",
  product_quarantined: () => "Product quarantined",
  out_of_stock: () => "Out of stock",
  invalid_quantity: () => "Invalid quantity",
};
const FINAL_LABELS = {
  approved: "Paid",
  evaluator_veto: "Refused: not what you asked for",
  exceeds_remaining_hold: "Refused: over your budget",
  duplicate_line: "Refused: listed twice",
};

/** The demo store's two simulated traps, so a refused line can say which trick it was. */
const TRAPS = {
  "PET-9001": "Trap: a hidden note on the lamb food page told your AI to add this.",
  "PET-3010": "Trap: a fake review told your AI it had to buy a pack of 5.",
};
const trapFor = (cart, l) => (cart.scenario === "attack" ? TRAPS[l.sku] : null);

const STEP_MS = 420;
const GRID = "grid grid-cols-[minmax(0,1.7fr)_5.5rem_minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.9fr)] gap-4";

function Verdict({ shown, ok, okText, children }) {
  if (!shown) return <span className="text-xs text-ink-3">Checking</span>;
  return <span className={`text-[13px] animate-rise ${ok ? "text-ink-2" : "font-medium text-bad"}`}>{ok ? okText : children}</span>;
}

/** Replays the engine's real decisions one stage at a time; reports the running approved total. */
export default function FirewallPanel({ cart, policy, theme, payments, animate, onProgress, onDone, onStartOver }) {
  const total = cart.lines.length * 3;
  const [stage, setStage] = useState(animate ? 0 : total);
  const ref = useRef(null);

  // A fresh result comes into view on its own; wait for the agent log's own scroll to finish first.
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 800);
    return () => clearTimeout(t);
  }, [animate]);

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
  const caught = cart.lines.filter((l) => trapFor(cart, l) && l.final.decision !== "approved").length;
  const verdict = caught
    ? `Your AI was tricked ${caught === 1 ? "once" : `${caught === 2 ? "twice" : `${caught} times`}`}. Leash refused ${caught === 1 ? "it" : "both"}, paid ${usd(cart.captured_cents)} for what you asked for, and gave ${usd(cart.released_cents)} back.`
    : cart.status === "blocked"
      ? `Nothing your AI picked followed your rules, so Leash paid nothing and gave all ${usd(cart.released_cents)} back.`
      : `Leash paid ${usd(cart.captured_cents)} for what followed your rules and gave ${usd(cart.released_cents)} back.`;

  return (
    <section ref={ref} className="scroll-mt-20 border-t border-line pt-6">
      <PanelHead step={4} title="What Leash paid for">
        Every item gets two checks: does it break one of your rules, and is it what you actually asked for? It has to pass both to be paid.
      </PanelHead>
      {complete && <p className="mb-5 max-w-[62ch] text-[17px] leading-relaxed text-ink animate-rise">{verdict}</p>}

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-[780px]">
          <div className={`${GRID} border-b border-line pb-2 text-xs text-ink-3`}>
            <div>Your AI wanted</div><div className="text-right">Price</div><div>Breaks a rule?</div><div>What you asked for?</div><div>Result</div>
          </div>
          {cart.lines.map((l, i) => {
            if (animate && stage < i * 3) return null;
            const s1 = stage >= i * 3 + 1, s2 = stage >= i * 3 + 2, s3 = stage >= i * 3 + 3;
            const ok = l.final.decision === "approved";
            return (
              <div key={l.sku} className={`${GRID} items-start border-b border-line py-3.5 animate-rise last:border-0`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium"><span className="num text-ink-2">{l.qty} ×</span> {l.name || l.sku}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-3">Its reason: “{l.agent_reason}”</div>
                  {trapFor(cart, l) && s3 && <div className="mt-1.5 text-xs font-medium text-warn animate-rise">{trapFor(cart, l)}</div>}
                </div>
                <div className={`num text-right text-sm ${s3 && !ok ? "text-ink-3 line-through decoration-bad/60" : ""}`}>{usd(l.line_total_cents)}</div>
                <div><Verdict shown={s1} ok={l.deterministic.decision === "approved"} okText="No">
                  {(RULE_LABELS[l.deterministic.rule] || (() => l.deterministic.rule))(l, policy)}</Verdict></div>
                <div>
                  <Verdict shown={s2} ok={l.evaluator.decision === "approved"} okText="Yes">No</Verdict>
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
        <div className="grid items-center gap-x-6 gap-y-3 border-t border-line-strong py-4 animate-rise sm:grid-cols-[1fr_auto_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="text-ink-2">Your AI wanted <span className="num ml-1 text-ink">{usd(cart.proposed_total_cents)}</span></span>
              <span className="text-ink-3">−</span>
              <span className="text-ink-2">Refused <span className="num ml-1 text-bad">{usd(blocked)}</span></span>
              <span className="text-ink-3">=</span>
              <span className="text-ink-2">Paid <span className="num ml-1 text-2xl text-ok">{usd(cart.captured_cents)}</span></span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              {cart.paypal.capture_id
                ? (payments === "sandbox"
                  ? <>PayPal sandbox capture <span className="num">{cart.paypal.capture_id}</span> {cart.paypal.capture_status?.toLowerCase()} with final_capture, which released the rest. Authorization read back as {cart.paypal.authorization_status_after}.</>
                  : <>Simulated capture <span className="num">{cart.paypal.capture_id}</span>, same rules as the PayPal sandbox: final_capture released the rest; authorization read back as {cart.paypal.authorization_status_after}.</>)
                : cart.status === "blocked" ? "Nothing passed, so the whole authorization was voided." : "No capture was made."}
            </p>
          </div>
          <HoldObject theme={theme} mode="settle" className="size-32 shrink-0 justify-self-start sm:justify-self-auto"
            releasedCoins={Math.round((cart.released_cents / Math.max(1, cart.captured_cents + cart.released_cents)) * 8)}
            label={`Settled: ${usd(cart.captured_cents)} captured stays in the strap, ${usd(cart.released_cents)} released lifts out.`} />
          <div className="text-sm text-ink-2">Back to you<div className="num text-2xl text-accent">{usd(cart.released_cents)}</div></div>
        </div>
      )}
      {complete && onStartOver && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button className="btn-secondary" onClick={onStartOver}><RotateCcw className="size-4" />Try again with different rules</button>
          <a href="#isolation" className="text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">Could the AI just pay by itself?</a>
        </div>
      )}
    </section>
  );
}
