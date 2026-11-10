import { useEffect, useMemo, useState } from "react";
import { ClientSideRowModelModule, ModuleRegistry, TextFilterModule, TooltipModule, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Link2, Link2Off } from "lucide-react";
import { api } from "../api";

ModuleRegistry.registerModules([ClientSideRowModelModule, TextFilterModule, TooltipModule]);

const TONE = {
  blocked: "badge-bad", veto: "badge-bad", denied: "badge-bad", failed: "badge-bad",
  passed: "badge-ok", consistent: "badge-ok", COMPLETED: "badge-ok", CAPTURED: "badge-ok", signed: "badge-ok",
  CREATED: "badge-hold", VOIDED: "badge-hold", awaiting_buyer_approval: "badge-warn",
};

function DecisionCell({ value }) {
  return value ? <span className={TONE[value] || "badge-muted"}>{value}</span> : null;
}

const theme = themeQuartz.withParams({
  fontFamily: "Inter, sans-serif", fontSize: 13, headerFontWeight: 600, borderRadius: 10, wrapperBorderRadius: 14,
  backgroundColor: "#140e18", headerBackgroundColor: "#1c1421", borderColor: "rgba(255,255,255,0.08)",
  foregroundColor: "#f7eef4", headerTextColor: "#cdbac7", oddRowBackgroundColor: "#170f1b",
  rowHoverColor: "rgba(244,114,182,0.07)", accentColor: "#f472b6", chromeBackgroundColor: "#1c1421",
});

export default function EventGrid({ mandateId, refreshKey, live }) {
  const [rows, setRows] = useState([]);
  const [chain, setChain] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [audit, verify] = await Promise.all([api.audit(mandateId), api.verifyChain()]);
        if (!cancelled) { setRows(audit.events); setChain(verify); }
      } catch { /* keep the last good view */ }
    }
    load();
    const timer = live ? setInterval(load, 1200) : null;
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [mandateId, refreshKey, live]);

  const columnDefs = useMemo(() => [
    { field: "timestamp", headerName: "Time", width: 100, valueFormatter: (p) => new Date(p.value + "Z").toLocaleTimeString() },
    { field: "event_type", headerName: "Event", width: 160, filter: true },
    { field: "source", headerName: "Source", width: 130, filter: true },
    { field: "decision", headerName: "Decision", width: 150, cellRenderer: DecisionCell, filter: true },
    { field: "rule_fired", headerName: "Rule", width: 180 },
    { field: "reason_summary", headerName: "Detail", flex: 1, minWidth: 280, tooltipField: "reason_summary" },
    { field: "entry_hash", headerName: "Hash", width: 110, valueFormatter: (p) => (p.value ? p.value.slice(0, 10) + "…" : "") },
  ], []);

  return (
    <section className="card card-pad">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Audit · AG Grid</div>
          <h2 className="mt-1 text-lg font-semibold">Security event trail</h2>
        </div>
        {chain && (chain.ok
          ? <span className="badge-ok"><Link2 className="size-3.5" /> Hash chain intact · {chain.checked} entries</span>
          : <span className="badge-bad"><Link2Off className="size-3.5" /> Chain broken at #{chain.first_bad_id}</span>)}
      </header>
      <div className="h-[420px] w-full">
        <AgGridReact theme={theme} rowData={rows} columnDefs={columnDefs} getRowId={(p) => String(p.data.id)}
          animateRows defaultColDef={{ sortable: true, resizable: true }} tooltipShowDelay={300} />
      </div>
      <p className="mt-3 text-xs text-ink-3">Each row stores the hash of the one before it, so editing any past entry breaks the chain. Tamper-evident, not proof of intent.</p>
    </section>
  );
}
