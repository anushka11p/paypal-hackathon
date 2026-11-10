import { CheckCircle2, Clock, Undo2, Wallet } from "lucide-react";
import { usd } from "../api";

function status(mandate, settling) {
  if (!mandate) return ["badge-muted", "NO HOLD"];
  if (mandate.status === "pending_approval") return ["badge-warn", "AWAITING APPROVAL"];
  if (mandate.status === "revoked") return ["badge-muted", "HOLD RELEASED"];
  if (mandate.status === "settled" && !settling) return ["badge-ok", "SETTLED"];
  return ["badge-hold", "ACTIVE HOLD"];
}

function Row({ label, value, tone = "", hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <div>
        <div className="text-sm text-ink-2">{label}</div>
        {hint && <div className="text-[11px] text-ink-3">{hint}</div>}
      </div>
      <div className={`text-lg font-semibold tabular-nums transition-colors ${tone}`}>{value}</div>
    </div>
  );
}

/**
 * revealedApprovedCents: during the firewall animation, how much has been approved so far,
 * so "remaining available" counts down item by item. null once the animation is done.
 */
export default function EscrowWidget({ mandate, cart, payments, revealedApprovedCents, settling }) {
  const [tone, label] = status(mandate, settling);
  const hold = mandate?.hold_cents ?? 0;
  const done = cart && !settling;
  const captured = done ? cart.captured_cents : 0;
  const released = done ? cart.released_cents : mandate?.status === "revoked" ? hold : 0;
  const approvedSoFar = revealedApprovedCents ?? (done ? cart.approved_total_cents : 0);
  // Once settled, nothing remains on hold: the unapproved part was released back.
  const remaining = mandate && mandate.status !== "revoked" && !done ? Math.max(hold - approvedSoFar, 0) : 0;

  return (
    <section className="card overflow-hidden lg:sticky lg:top-6">
      <div className="flex items-center justify-between bg-paypal px-5 py-4 text-white">
        <div className="flex items-center gap-2 font-semibold"><Wallet className="size-4" /> PayPal escrow</div>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
          {payments === "sandbox" ? "Sandbox" : "Simulator"}
        </span>
      </div>
      <div className="card-pad">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">Step 2 · Hold</span>
          <span className={`${tone} ${label === "ACTIVE HOLD" ? "animate-pulse-ring" : ""}`}>{label}</span>
        </div>
        <div className="divide-y divide-line">
          <Row label="Authorized amount" value={usd(hold)} tone="text-hold"
            hint={mandate && !done ? "Hold only — $0.00 captured yet" : null} />
          <Row label="Remaining available hold" value={usd(remaining)} />
          <Row label="Captured by PayPal" value={usd(captured)} tone={captured ? "text-ok-ink" : "text-ink-3"} />
          <Row label="Released to you" value={usd(released)} tone={released ? "text-hold" : "text-ink-3"} />
        </div>
        {done && cart.status === "captured" && (
          <div className="mt-4 grid gap-2 animate-rise">
            <span className="badge-ok w-fit"><CheckCircle2 className="size-3.5" /> SETTLED {usd(captured)}</span>
            {released > 0 && <span className="badge-hold w-fit"><Undo2 className="size-3.5" /> HOLD RELEASED {usd(released)}</span>}
          </div>
        )}
        {done && cart.status === "blocked" && (
          <span className="badge-hold mt-4 w-fit animate-rise"><Undo2 className="size-3.5" /> Nothing passed · full hold voided</span>
        )}
        {mandate?.paypal?.authorization_id && (
          <dl className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-[11px] text-ink-3">
            <div className="flex justify-between gap-2"><dt>Order</dt><dd className="truncate">{mandate.paypal.order_id}</dd></div>
            <div className="flex justify-between gap-2"><dt>Authorization</dt><dd className="truncate">{mandate.paypal.authorization_id}</dd></div>
            {done && cart.paypal.capture_id && <div className="flex justify-between gap-2"><dt>Capture</dt><dd className="truncate">{cart.paypal.capture_id}</dd></div>}
            <div className="flex justify-between gap-2"><dt>Auth status</dt><dd>{mandate.paypal.authorization_status}</dd></div>
          </dl>
        )}
        {mandate?.status === "pending_approval" && (
          <a className="btn-paypal mt-4 w-full" href={mandate.paypal.approve_url}><Clock className="size-4" /> Finish PayPal approval</a>
        )}
      </div>
    </section>
  );
}
