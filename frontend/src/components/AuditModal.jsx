import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";

export default function AuditModal({ mandateId, mandate, cart, onClose }) {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("mandate");

  useEffect(() => { api.audit(mandateId).then((r) => setEvents(r.events)).catch(() => {}); }, [mandateId]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabs = {
    mandate: ["Mandate (signed)", mandate],
    agent: ["Agent → Leash", cart && { scenario: cart.scenario, model: cart.agent.model, proposed_lines: cart.lines.map((l) => ({ sku: l.sku, qty: l.qty, reason: l.agent_reason })), summary: cart.agent.summary }],
    leash: ["Leash decisions", cart && cart.lines.map((l) => ({ sku: l.sku, qty: l.qty, line_total_cents: l.line_total_cents, layer_1: l.deterministic, layer_2: l.evaluator, final: l.final }))],
    paypal: ["Leash → PayPal", cart && { authorization_id: mandate?.paypal.authorization_id, capture: { amount_cents: cart.captured_cents, final_capture: true, ...cart.paypal }, released_cents: cart.released_cents }],
    trail: ["Hash-chained trail", events],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Raw audit log">
      <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Raw audit log <span className="ml-1 font-mono text-xs text-ink-3">{mandateId}</span></h2>
          <button className="rounded-lg p-1.5 hover:bg-slate-100" onClick={onClose} aria-label="Close"><X className="size-4" /></button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
          {Object.entries(tabs).map(([k, [label]]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === k ? "bg-ink text-white" : "text-ink-2 hover:bg-slate-100"}`}>{label}</button>
          ))}
        </div>
        <pre className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-[11.5px] leading-relaxed text-slate-200">
          {tabs[tab][1] ? JSON.stringify(tabs[tab][1], null, 2) : "Nothing yet. Run the agent first."}
        </pre>
      </div>
    </div>
  );
}
