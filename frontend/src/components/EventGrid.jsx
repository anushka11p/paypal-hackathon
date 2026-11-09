import { useEffect, useMemo, useState } from "react";
import {
  ClientSideRowModelModule, ModuleRegistry, TextFilterModule, TooltipModule, colorSchemeDarkBlue, themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { api } from "../api";

ModuleRegistry.registerModules([ClientSideRowModelModule, TextFilterModule, TooltipModule]);

const DECISION_TONE = {
  blocked: "bad", veto: "bad", denied: "bad", failed: "bad", void_failed: "bad",
  passed: "ok", consistent: "ok", COMPLETED: "ok", CAPTURED: "ok", CREATED: "hold", VOIDED: "hold",
};

function DecisionCell({ value }) {
  if (!value) return null;
  return <span className={`chip ${DECISION_TONE[value] || ""}`}>{value}</span>;
}

const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
const theme = (prefersDark ? themeQuartz.withPart(colorSchemeDarkBlue) : themeQuartz).withParams({
  fontFamily: "Inter, sans-serif", fontSize: 13, headerFontWeight: 600, borderRadius: 10, wrapperBorderRadius: 12,
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
    const timer = live ? setInterval(load, 1500) : null;
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [mandateId, refreshKey, live]);

  const columnDefs = useMemo(() => [
    { field: "timestamp", headerName: "Time", width: 110, valueFormatter: (p) => new Date(p.value + "Z").toLocaleTimeString() },
    { field: "event_type", headerName: "Event", width: 170 },
    { field: "source", headerName: "Source", width: 130, filter: true },
    { field: "decision", headerName: "Decision", width: 140, cellRenderer: DecisionCell, filter: true },
    { field: "rule_fired", headerName: "Rule", width: 190 },
    { field: "reason_summary", headerName: "Detail", flex: 1, minWidth: 260, tooltipField: "reason_summary" },
    { field: "entry_hash", headerName: "Hash", width: 120, valueFormatter: (p) => p.value?.slice(0, 10) + "…" },
  ], []);

  return (
    <section className="step">
      <div className="step-head">
        <h2><span className="step-num">05</span>Security events</h2>
        <div className="row">
          {chain && (
            <span className={`chip ${chain.ok ? "ok" : "bad"}`}><span className="dot" />
              {chain.ok ? `Hash chain intact · ${chain.checked} entries` : `Chain broken at entry ${chain.first_bad_id}`}
            </span>
          )}
          {live && <span className="chip hold"><span className="spinner" style={{ width: 10, height: 10 }} />live</span>}
        </div>
      </div>
      <div className="grid-host">
        <AgGridReact theme={theme} rowData={rows} columnDefs={columnDefs} getRowId={(p) => String(p.data.id)}
          animateRows defaultColDef={{ sortable: true, resizable: true }} tooltipShowDelay={300} />
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        Every row stores the hash of the one before it, so editing any past entry breaks the chain. It's tamper-evident, not proof of what you meant.
      </p>
    </section>
  );
}
