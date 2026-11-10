import { usd } from "../api";
import { PanelHead } from "./MandatePanel";

function status(mandate, settling) {
  if (!mandate) return ["badge-muted", "No hold"];
  if (mandate.status === "pending_approval") return ["badge-warn", "Awaiting approval"];
  if (mandate.status === "revoked") return ["badge-muted", "Released"];
  if (mandate.status === "settled" && !settling) return ["badge-ok", "Settled"];
  return ["badge-hold", "Active hold"];
}

function Line({ label, value, tone = "text-ink", hint, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-3 last:border-0">
      <div>
        <div className="text-[13px] text-ink-2">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-ink-3">{hint}</div>}
      </div>
      <div className={`num transition-colors duration-300 ${strong ? "text-xl" : "text-[15px]"} ${tone}`}>{value}</div>
    </div>
  );
}

/**
 * revealedApprovedCents: while the firewall animation plays, how much has been approved so far,
 * so the remaining hold counts down item by item. null once the animation is done.
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
    <section className="card p-5 sm:p-6 lg:sticky lg:top-20">
      <PanelHead title="PayPal hold" aside={<span className={tone}>{label}</span>}>
        {payments === "sandbox" ? "PayPal sandbox" : "Payment simulator, same rules as the sandbox"}
      </PanelHead>
      <div>
        <Line label="Authorized" value={usd(hold)} tone="text-accent" strong
          hint={mandate && !done ? "Held, not charged" : null} />
        <Line label="Still on hold" value={usd(remaining)} tone={remaining ? "text-ink" : "text-ink-3"} />
        <Line label="Captured" value={usd(captured)} tone={captured ? "text-ok" : "text-ink-3"} />
        <Line label="Released to you" value={usd(released)} tone={released ? "text-accent" : "text-ink-3"} />
      </div>

      {done && cart.status === "blocked" && (
        <p className="mt-3 text-[13px] text-ink-2 animate-rise">Nothing passed. The full hold was voided.</p>
      )}

      {mandate?.paypal?.authorization_id && (
        <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-[11px]">
          {payments !== "sandbox" && <div className="pb-1 text-ink-3">Simulated references</div>}
          {[["Order", mandate.paypal.order_id], ["Authorization", mandate.paypal.authorization_id],
            ...(done && cart.paypal.capture_id ? [["Capture", cart.paypal.capture_id]] : []),
            ["Status", mandate.paypal.authorization_status]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-3">{k}</dt><dd className="num truncate text-ink-2">{v}</dd></div>
          ))}
        </dl>
      )}
      {mandate?.status === "pending_approval" && (
        <a className="btn-primary mt-5 w-full" href={mandate.paypal.approve_url}>Finish PayPal approval</a>
      )}
    </section>
  );
}
