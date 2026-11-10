import { useEffect, useMemo, useState } from "react";
import { CellStyleModule, ClientSideRowModelModule, ModuleRegistry, TextFilterModule, TooltipModule, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Link2, Link2Off } from "lucide-react";
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

const BASE = { fontFamily: "Geist, sans-serif", fontSize: 13, headerFontWeight: 500, borderRadius: 8, wrapperBorderRadius: 12, rowHeight: 40, headerHeight: 38, spacing: 7 };
const THEMES = {
  light: themeQuartz.withParams({ ...BASE, backgroundColor: "#ffffff", headerBackgroundColor: "#f6f7f9", borderColor: "#e3e5ea",
    foregroundColor: "#0e1014", headerTextColor: "#4a505c", rowHoverColor: "#f6f7f9", accentColor: "#3d49d6" }),
  dark: themeQuartz.withParams({ ...BASE, backgroundColor: "#111317", headerBackgroundColor: "#0d0f12", borderColor: "#22262d",
    foregroundColor: "#eceef1", headerTextColor: "#a7adb9", rowHoverColor: "#181b20", accentColor: "#8f98ff", chromeBackgroundColor: "#0d0f12" }),
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
    <section className="card p-5 sm:p-6">
      <PanelHead title="Audit trail"
        aside={chain && (chain.ok
          ? <span className="badge-ok"><Link2 className="size-3.5" /> Chain intact · <span className="num">{chain.checked}</span></span>
          : <span className="badge-bad"><Link2Off className="size-3.5" /> Broken at #{chain.first_bad_id}</span>)}>
        Every proposal, check, verdict and PayPal call. Each entry stores the hash of the one before it, so any edit to history shows.
      </PanelHead>
      <div className="h-[440px] w-full">
        <AgGridReact theme={THEMES[theme] || THEMES.light} rowData={rows} columnDefs={columnDefs} getRowId={(p) => String(p.data.id)}
          animateRows defaultColDef={{ sortable: true, resizable: true }} tooltipShowDelay={300}
          overlayNoRowsTemplate="<span style='opacity:.6'>No events yet. Write a mandate to start.</span>" />
      </div>
    </section>
  );
}
