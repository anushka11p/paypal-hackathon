import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";

export default function AuditModal({ mandateId, mandate, cart, onClose }) {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("mandate");
  const closeRef = useRef(null);

  useEffect(() => { api.audit(mandateId).then((r) => setEvents(r.events)).catch(() => {}); }, [mandateId]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabs = {
    mandate: ["Signed mandate", mandate],
    agent: ["Agent → Leash", cart && { scenario: cart.scenario, model: cart.agent.model, proposed_lines: cart.lines.map((l) => ({ sku: l.sku, qty: l.qty, reason: l.agent_reason })), summary: cart.agent.summary }],
    leash: ["Leash decisions", cart && cart.lines.map((l) => ({ sku: l.sku, qty: l.qty, line_total_cents: l.line_total_cents, rules: l.deterministic, intent: l.evaluator, final: l.final }))],
    paypal: ["Leash → PayPal", cart && { authorization_id: mandate?.paypal.authorization_id, capture: { amount_cents: cart.captured_cents, final_capture: true, ...cart.paypal }, released_cents: cart.released_cents }],
    trail: ["Hash chain", events],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Raw audit log">
      <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold">Raw audit log <span className="num ml-1 text-xs font-normal text-ink-3">{mandateId}</span></h2>
          <button ref={closeRef} className="btn-quiet !p-1.5" onClick={onClose} aria-label="Close"><X className="size-4" /></button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2" role="tablist">
          {Object.entries(tabs).map(([k, [label]]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${tab === k ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-2"}`}>{label}</button>
          ))}
        </div>
        <pre className="flex-1 overflow-auto bg-sunken p-5 font-mono text-[12px] leading-relaxed text-ink-2">
          {tabs[tab][1] ? JSON.stringify(tabs[tab][1], null, 2) : "Nothing yet. Run the agent first."}
        </pre>
      </div>
    </div>
  );
}
