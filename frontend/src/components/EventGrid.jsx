import { useEffect, useMemo, useState } from "react";
import { CellStyleModule, ClientSideRowModelModule, ModuleRegistry, TextFilterModule, TooltipModule, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { api } from "../api";
import { PanelHead } from "./MandatePanel";

ModuleRegistry.registerModules([CellStyleModule, ClientSideRowModelModule, TextFilterModule, TooltipModule]);

const TONE = {
  blocked: "badge-bad", veto: "badge-bad", denied: "badge-bad", failed: "badge-bad",
  passed: "badge-ok", consistent: "badge-ok", COMPLETED: "badge-ok", CAPTURED: "badge-ok", signed: "badge-ok",
  CREATED: "badge-hold", VOIDED: "badge-hold", awaiting_buyer_approval: "badge-warn",
};

function DecisionCell({ value }) {
  return value ? <span className={TONE[value] || "badge-muted"}>{value.replace(/_/g, " ")}</span> : null;
}

const BASE = { fontFamily: "Geist, sans-serif", fontSize: 15, headerFontWeight: 600, borderRadius: 10, wrapperBorderRadius: 20, rowHeight: 48, headerHeight: 46, spacing: 8 };
const THEMES = {
  light: themeQuartz.withParams({ ...BASE, backgroundColor: "#ffffff", headerBackgroundColor: "#f5f7fa", borderColor: "#dbe2ea",
    foregroundColor: "#001435", headerTextColor: "#36455e", rowHoverColor: "#f5f7fa", accentColor: "#0064d2" }),
  dark: themeQuartz.withParams({ ...BASE, backgroundColor: "#06287a", headerBackgroundColor: "#001650", borderColor: "#173c8f",
    foregroundColor: "#ffffff", headerTextColor: "#c5d3ee", rowHoverColor: "#0c3594", accentColor: "#6cc3ff", chromeBackgroundColor: "#001650" }),
};

export default function EventGrid({ mandateId, refreshKey, live, theme = "light" }) {
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
    { field: "timestamp", headerName: "Time", width: 100, valueFormatter: (p) => new Date(p.value + "Z").toLocaleTimeString(), cellClass: "num" },
    { field: "event_type", headerName: "Event", width: 170, filter: true, valueFormatter: (p) => p.value?.replace(/_/g, " ") },
    { field: "source", headerName: "Source", width: 130, filter: true },
    { field: "decision", headerName: "Decision", width: 170, cellRenderer: DecisionCell, filter: true },
    { field: "rule_fired", headerName: "Rule", width: 190, valueFormatter: (p) => p.value?.replace(/_/g, " ") ?? "" },
    { field: "reason_summary", headerName: "Detail", flex: 1, minWidth: 280, tooltipField: "reason_summary" },
    { field: "entry_hash", headerName: "Hash", width: 120, cellClass: "num", valueFormatter: (p) => (p.value ? p.value.slice(0, 10) + "…" : "") },
  ], []);

  return (
    <section>
      <PanelHead big title="The full record"
        aside={chain && (chain.ok
          ? <span className="badge-ok">Record intact, <span className="num">{chain.checked}</span> entries</span>
          : <span className="badge-bad">Record broken at entry {chain.first_bad_id}</span>)}>
        Everything that happened, in order. Each entry is locked to the one before it, so nobody can quietly change history.
      </PanelHead>
      <div className="h-[520px] w-full">
        <AgGridReact theme={THEMES[theme] || THEMES.light} rowData={rows} columnDefs={columnDefs} getRowId={(p) => String(p.data.id)}
          animateRows defaultColDef={{ sortable: true, resizable: true }} tooltipShowDelay={300}
          overlayNoRowsTemplate="<span style='opacity:.6'>Nothing yet. Set your rules above to start.</span>" />
      </div>
    </section>
  );
}
