import { usd } from "../api";
import { PanelHead } from "./MandatePanel";

function status(mandate, settling) {
  if (!mandate) return ["badge-muted", "Nothing held"];
  if (mandate.status === "pending_approval") return ["badge-warn", "Waiting for you"];
  if (mandate.status === "revoked") return ["badge-muted", "All returned"];
  if (mandate.status === "settled" && !settling) return ["badge-ok", "Paid and settled"];
  return ["badge-hold", "Held"];
}

function Line({ label, value, tone = "text-ink", hint, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-3 last:border-0">
      <div>
        <div className="text-[15px] text-ink-2">{label}</div>
        {hint && <div className="mt-0.5 text-[13px] text-ink-3">{hint}</div>}
      </div>
      <div className={`num transition-colors duration-300 ${strong ? "text-xl" : "text-[17px]"} ${tone}`}>{value}</div>
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
    <section className="card p-6 sm:p-7">
      <PanelHead title="Your money" aside={<span key={label} className={`${tone} animate-rise`}>{label}</span>}>
        {payments === "sandbox" ? "On the PayPal sandbox" : "On a pretend PayPal that follows the same rules"}
      </PanelHead>
      <div>
        <Line label="Set aside" value={usd(hold)} tone={hold ? "text-accent" : "text-ink-3"} strong
          hint={mandate?.status === "active" && !done ? "Held, not charged" : null} />
        <Line label="Still set aside" value={usd(remaining)} tone={remaining ? "text-ink" : "text-ink-3"} />
        <Line label="Paid to the store" value={usd(captured)} tone={captured ? "text-ok" : "text-ink-3"} />
        <Line label="Back to you" value={usd(released)} tone={released ? "text-accent" : "text-ink-3"} />
      </div>

      {done && cart.status === "blocked" && (
        <p className="mt-3 text-[15px] text-ink-2 animate-rise">Nothing followed your rules, so nothing was paid. All of it came back.</p>
      )}

      {mandate?.paypal?.authorization_id && (
        <details className="mt-5 border-t border-line pt-3 text-[13px]">
          <summary className="cursor-pointer list-none text-ink-3 hover:text-ink-2">{payments === "sandbox" ? "PayPal references" : "Payment references (simulated)"}</summary>
          <dl className="mt-2 space-y-1.5">
          {[["Order", mandate.paypal.order_id], ["Authorization", mandate.paypal.authorization_id],
            ...(done && cart.paypal.capture_id ? [["Capture", cart.paypal.capture_id]] : []),
            ["Status", mandate.paypal.authorization_status]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-3">{k}</dt><dd className="num truncate text-ink-2">{v}</dd></div>
          ))}
          </dl>
        </details>
      )}
      {mandate?.status === "pending_approval" && (
        <a className="btn-primary mt-5 w-full" href={mandate.paypal.approve_url}>Approve on PayPal</a>
      )}
    </section>
  );
}
