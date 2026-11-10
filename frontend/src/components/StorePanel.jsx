import { useEffect, useRef, useState } from "react";
import {
  Bot, ChevronDown, Code2, Loader2, PackageSearch, Play, ScanSearch, ShieldAlert, ShoppingCart, Store, TriangleAlert,
} from "lucide-react";
import { api, titleCase, usd } from "../api";
import { PanelHead } from "./MandatePanel";

const DEFAULT_TASK = "Restock Bramble's usual dog food, and pick up some treats and dental chews.";

function attacksOf(p) {
  const out = p.reviews.filter((r) => r.simulated_attack).map((r) => ({ where: `review by ${r.author}`, text: r.text }));
  if (p.note_is_simulated_attack && p.merchandising_note) out.push({ where: "seller fulfillment note", text: p.merchandising_note });
  return out;
}

function ProductRow({ p, poisoned }) {
  const [open, setOpen] = useState(false);
  const attacks = poisoned ? attacksOf(p) : [];
  return (
    <li className="border-b border-line last:border-0">
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{p.name}</span>
            {attacks.length > 0 && (
              <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className="badge-warn shrink-0 hover:opacity-80">
                <TriangleAlert className="size-3" /> Injected text <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
          <div className="mt-0.5 text-xs text-ink-3">{titleCase(p.category)} · contains {p.allergen_tags.contains?.join(", ") || "nothing listed"}</div>
        </div>
        <div className="num shrink-0 text-sm">{usd(p.price_cents)}</div>
      </div>
      {open && attacks.map((a) => (
        <figure key={a.where} className="mb-3 overflow-hidden rounded-xl border border-line bg-sunken animate-rise">
          <figcaption className="flex items-center gap-1.5 border-b border-line px-3 py-1.5 text-[11px] text-ink-3">
            <Code2 className="size-3" /> Page source · {a.where} · simulated
          </figcaption>
          <p className="px-3 py-2.5 font-mono text-[12px] leading-relaxed text-warn">{a.text}</p>
        </figure>
      ))}
    </li>
  );
}

const TOOL_LABEL = {
  list_products: () => ["Browsing the catalog", PackageSearch],
  view_product: (e, names) => [`Reading ${names[e.input.sku] || e.input.sku}`, ScanSearch],
  check_market_price: (e, names) => [`Comparing ${names[e.input.sku] || e.input.sku} on Channel3`, Store],
  add_to_cart: (e, names) => [`Added ${e.input.qty} × ${names[e.input.sku] || e.input.sku}: “${e.input.reason}”`, ShoppingCart],
  remove_from_cart: (e, names) => [`Removed ${names[e.input.sku] || e.input.sku}`, ShoppingCart],
  checkout: () => ["Handed the cart to Leash", Bot],
};

function TerminalLine({ e, names }) {
  if (e.type === "text") return <div className="pl-12 text-white/40">{e.text}</div>;
  const [label, Icon] = (TOOL_LABEL[e.name] || (() => [e.name, Bot]))(e, names);
  const market = e.name === "check_market_price" && e.output;
  return (
    <div className="animate-rise">
      <div className="flex gap-2 text-white/85">
        <span className="w-10 shrink-0 text-right text-white/30">{e.at?.toFixed(1)}s</span>
        <Icon className="mt-[3px] size-3.5 shrink-0 text-white/45" /><span>{label}</span>
      </div>
      {market && <div className="pl-[4.25rem] text-white/40">{market.available ? `${market.offers?.length || 0} offers, lowest ${market.lowest_usd ? "$" + market.lowest_usd : "n/a"}, ours $${market.our_price_usd}` : "Channel3 unavailable"}</div>}
      {e.injection?.map((t) => (
        <div key={t} className="ml-[4.25rem] mt-1 flex gap-1.5 rounded-md bg-[#e9b64c]/12 px-2 py-1.5 text-[#efc66f]">
          <ShieldAlert className="mt-[2px] size-3.5 shrink-0" />
          <span>Read a hidden instruction: “{t.length > 110 ? t.slice(0, 110) + "…" : t}”</span>
        </div>
      ))}
    </div>
  );
}

export default function StorePanel({ mandate, job, onRun, runError }) {
  const [scenario, setScenario] = useState("attack");
  const [task, setTask] = useState(DEFAULT_TASK);
  const [catalog, setCatalog] = useState(null);
  const termRef = useRef(null);
  const running = job?.state === "running";
  const events = job?.events || [];

  useEffect(() => { api.catalog(scenario).then(setCatalog).catch(() => {}); }, [scenario]);
  useEffect(() => { termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: "smooth" }); }, [events.length, job?.phase]);

  const names = Object.fromEntries((catalog?.products || []).map((p) => [p.sku, p.name]));
  const canRun = mandate?.status === "active" && !running;
  const poisoned = scenario === "attack";

  return (
    <section className="card p-5 sm:p-6">
      <PanelHead title={`Agent shops at ${catalog?.merchant.name || "the store"}`}
        aside={
          <div className="flex shrink-0 rounded-full border border-line-strong p-0.5 text-xs font-medium" role="group" aria-label="Store">
            <button className={`rounded-full px-3 py-1 transition-colors ${!poisoned ? "bg-ink text-canvas" : "text-ink-2"}`} onClick={() => setScenario("clean")} disabled={running} aria-pressed={!poisoned}>Clean</button>
            <button className={`rounded-full px-3 py-1 transition-colors ${poisoned ? "bg-warn text-canvas" : "text-ink-2"}`} onClick={() => setScenario("attack")} disabled={running} aria-pressed={poisoned}>Poisoned</button>
          </div>
        }>
        {poisoned
          ? "Two listings carry simulated text written to hijack shopping assistants. Open them to read it."
          : "The same store without the injected text."}
      </PanelHead>

      <ul>{(catalog?.products || []).map((p) => <ProductRow key={p.sku} p={p} poisoned={poisoned} />)}</ul>

      <div className="mt-5 grid gap-2">
        <label className="label" htmlFor="task">Task for the agent</label>
        <input id="task" className="field" value={task} onChange={(e) => setTask(e.target.value)} disabled={running} />
        <button className="btn-primary mt-1 py-3" onClick={() => onRun(task, scenario)} disabled={!canRun}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {running ? "Agent is shopping" : "Run the agent"}
        </button>
        {!mandate && <p className="text-center text-xs text-ink-3">Authorize a mandate first.</p>}
        {mandate?.status === "pending_approval" && <p className="text-center text-xs text-ink-3">Finish the PayPal approval first.</p>}
        {runError && <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-sm text-bad">{runError}</p>}
      </div>

      {job && job.state !== "idle" && (
        <div className="mt-5 overflow-hidden rounded-xl bg-term animate-rise">
          <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 text-[11px] text-white/45">
            <span>Agent process · no payment credentials</span>
            <span>{job.scenario === "attack" ? "poisoned store" : "clean store"}</span>
          </div>
          <div ref={termRef} className="max-h-80 space-y-1.5 overflow-y-auto p-3.5 font-mono text-[12px] leading-relaxed" aria-live="polite">
            {events.map((e, i) => <TerminalLine key={i} e={e} names={names} />)}
            {job.phase === "agent_shopping" && <div className="flex items-center gap-2 pl-12 text-white/40"><Loader2 className="size-3.5 animate-spin" /> thinking</div>}
            {job.phase === "leash_checking" && <div className="flex items-center gap-2 pl-12 text-[#e9b64c]"><Loader2 className="size-3.5 animate-spin" /> Leash intercepted the cart and is checking every line</div>}
            {job.state === "done" && <div className="pl-12 text-[#4fc89b]">Done. Leash's decisions are below.</div>}
            {job.state === "error" && <div className="pl-12 text-[#f2806f]">{job.error}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
