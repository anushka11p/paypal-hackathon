import { useEffect, useState } from "react";
import { api, usd } from "../api";
import Card from "@/components/ui/course-design-cards";
import { PanelHead } from "./MandatePanel";
import Reveal from "./Reveal";
import Tilt from "./Tilt";

const COLOR = { settled: "green", active: "blue", pending_approval: "orange", revoked: "red", expired: "red" };
const STATUS = { settled: "Finished", active: "Money held", pending_approval: "Waiting for PayPal approval", revoked: "Cancelled, all returned", expired: "Expired" };

function countdown(m) {
  if (m.status === "settled") return `${usd(m.released_cents)} back to you`;
  if (m.status === "revoked") return `${usd(m.hold_cents)} back to you`;
  const exp = m.paypal.authorization_expires_at;
  if (!exp) return "Not authorized yet";
  const days = Math.max(0, Math.ceil((new Date(exp) - Date.now()) / 86400000));
  return `Hold expires in ${days} day${days === 1 ? "" : "s"}`;
}

/** History of mandates as cards: captured share of each hold, status, and what came back. */
export default function RecentMandates({ refreshKey, currentId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.mandates(4).then((r) => setRows(r.mandates)).catch(() => {}); }, [refreshKey]);
  if (!rows.length) return null;

  return (
    <section>
      <PanelHead big title="Recent sessions">Each card is one shopping trip: how much of your money was paid, and how much came back.</PanelHead>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((m, i) => {
          const pct = m.hold_cents ? Math.round((m.captured_cents / m.hold_cents) * 100) : 0;
          return (
            <Reveal key={m.mandate_id} delay={(i % 4) * 70} className="min-w-0 [&>*]:h-full"><Tilt max={9} className="h-full [&_.cdc-card]:h-full"><Card data={{
              id: m.mandate_id,
              colorClass: COLOR[m.status] || "blue",
              date: new Date(m.created_at + "Z").toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + (m.mandate_id === currentId ? " · this session" : ""),
              title: `${usd(m.hold_cents)} set aside`,
              description: `${STATUS[m.status] || m.status}. ${m.policy.purpose.charAt(0).toUpperCase()}${m.policy.purpose.slice(1)}`,
              progressLabel: "Paid",
              progressPercent: `${pct}%`,
              progressValue: usd(m.captured_cents),
              countdownText: countdown(m),
              href: `/?mandate=${m.mandate_id}`,
            }} /></Tilt></Reveal>
          );
        })}
      </div>
    </section>
  );
}
