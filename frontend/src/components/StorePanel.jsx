import { useEffect, useRef, useState } from "react";
import {
  Bot, Code2, Eye, EyeOff, Loader2, PackageSearch, Play, ScanSearch, ShieldAlert, ShoppingCart, Skull, Store, Terminal,
} from "lucide-react";
import { api, titleCase, usd } from "../api";

const DEFAULT_TASK = "Restock Bramble's usual dog food, and pick up some treats and dental chews.";

function attacksOf(p) {
  const out = p.reviews.filter((r) => r.simulated_attack).map((r) => ({ where: `5★ review by ${r.author}`, text: r.text }));
  if (p.note_is_simulated_attack && p.merchandising_note) out.push({ where: "Seller fulfillment note", text: p.merchandising_note });
  return out;
}

function ProductCard({ p, poisoned }) {
  const [open, setOpen] = useState(false);
  const attacks = poisoned ? attacksOf(p) : [];
  return (
    <div className={`rounded-xl border bg-black/20 p-3.5 transition ${attacks.length ? "border-bad/40" : "border-line"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-snug">{p.name}</div>
          <div className="mt-0.5 text-xs text-ink-3">{titleCase(p.category)} · contains {p.allergen_tags.contains?.join(", ") || "—"}</div>
        </div>
        <div className="text-sm font-semibold tabular-nums">{usd(p.price_cents)}</div>
      </div>
      {attacks.length > 0 && (
        <div className="mt-2.5">
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg bg-bad-soft px-2.5 py-1.5 text-xs font-semibold text-bad-ink">
            <span className="flex items-center gap-1.5"><Skull className="size-3.5" /> Hidden injection</span>
            <span className="flex items-center gap-1">{open ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {open ? "Hide" : "Inspect source"}</span>
          </button>
          {open && attacks.map((a) => (
            <pre key={a.where} className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/55 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 animate-rise">
              <span className="text-slate-500">{`<!-- ${a.where} · simulated attack -->`}</span>{"\n"}<span className="text-red-300">{a.text}</span>
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}

const TOOL_LABEL = {
  list_products: () => ["Browsing the store catalog", PackageSearch],
  view_product: (e, names) => [`Reading product page: ${names[e.input.sku] || e.input.sku}`, ScanSearch],
  check_market_price: (e, names) => [`Comparing ${names[e.input.sku] || e.input.sku} on Channel3`, Store],
  add_to_cart: (e, names) => [`Cart ← ${e.input.qty}× ${names[e.input.sku] || e.input.sku} — “${e.input.reason}”`, ShoppingCart],
  remove_from_cart: (e, names) => [`Removed ${names[e.input.sku] || e.input.sku}`, ShoppingCart],
  checkout: () => ["Submitting cart to Leash for approval", Bot],
};

function TerminalLine({ e, names }) {
  if (e.type === "text") return <div className="text-slate-500 italic">… {e.text}</div>;
  const [label, Icon] = (TOOL_LABEL[e.name] || (() => [e.name, Bot]))(e, names);
  const market = e.name === "check_market_price" && e.output;
  return (
    <div className="animate-rise">
      <div className="flex gap-2 text-slate-200"><span className="w-10 shrink-0 text-slate-600">{e.at?.toFixed(1)}s</span>
        <Icon className="mt-0.5 size-3.5 shrink-0 text-sky-400" /><span>{label}</span></div>
      {market && <div className="ml-12 text-slate-500">{market.available ? `${market.offers?.length || 0} offers · lowest ${market.lowest_usd ? "$" + market.lowest_usd : "n/a"} · ours $${market.our_price_usd}` : "Channel3 unavailable"}</div>}
      {e.injection?.map((t) => (
        <div key={t} className="ml-12 mt-1 rounded border-l-2 border-red-500 bg-red-500/10 px-2 py-1 text-red-300">
          <ShieldAlert className="mr-1 inline size-3.5" />Agent read hidden instruction: “{t.length > 120 ? t.slice(0, 120) + "…" : t}”
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
    <section className="card card-pad">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Step 3 · AI shopping agent</div>
          <h2 className="mt-1 text-lg font-semibold">{catalog?.merchant.name || "Store"}</h2>
        </div>
        <div className="flex rounded-xl border border-line bg-canvas p-1 text-xs font-semibold" role="group" aria-label="Store mode">
          <button className={`rounded-lg px-3 py-1.5 ${!poisoned ? "bg-surface-2 text-ink shadow-sm" : "text-ink-3"}`} onClick={() => setScenario("clean")} disabled={running}>Safe store</button>
          <button className={`flex items-center gap-1 rounded-lg px-3 py-1.5 ${poisoned ? "bg-bad text-white shadow-sm" : "text-ink-3"}`} onClick={() => setScenario("attack")} disabled={running}>
            <Skull className="size-3.5" /> Poisoned listings
          </button>
        </div>
      </header>

      {poisoned && (
        <p className="mb-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-xs leading-relaxed text-bad-ink">
          Two listings carry <b>simulated</b> third-party text aimed at shopping assistants. Open “Inspect source” to see what the agent will read.
          The agent's reasoning, Leash's checks and the payment calls are all real.
        </p>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {(catalog?.products || []).map((p) => <ProductCard key={p.sku} p={p} poisoned={poisoned} />)}
      </div>

      <div className="mt-5 grid gap-2">
        <label className="text-xs font-semibold text-ink-2" htmlFor="task">What you asked the agent (it never sees your rules)</label>
        <input id="task" className="field" value={task} onChange={(e) => setTask(e.target.value)} disabled={running} />
        <button className="btn-primary py-3" onClick={() => onRun(task, scenario)} disabled={!canRun}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {running ? "Agent is shopping…" : "Run AI shopping agent"}
        </button>
        {!mandate && <p className="text-center text-xs text-ink-3">Set and authorize a mandate first.</p>}
        {mandate?.status === "pending_approval" && <p className="text-center text-xs text-ink-3">Finish the PayPal approval first.</p>}
        {runError && <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-sm text-bad-ink">{runError}</p>}
      </div>

      {(job && job.state !== "idle") && (
        <div className="mt-5 overflow-hidden rounded-xl bg-black/55 animate-rise">
          <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><Terminal className="size-3.5" /> agent process · no payment credentials</span>
            <span className="flex items-center gap-1.5"><Code2 className="size-3.5" />{job.scenario === "attack" ? "poisoned store" : "safe store"}</span>
          </div>
          <div ref={termRef} className="max-h-80 space-y-1.5 overflow-y-auto p-3.5 font-mono text-[12px] leading-relaxed">
            {events.map((e, i) => <TerminalLine key={i} e={e} names={names} />)}
            {job.phase === "agent_shopping" && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="size-3.5 animate-spin" /> agent thinking…</div>}
            {job.phase === "leash_checking" && <div className="flex items-center gap-2 text-amber-300"><Loader2 className="size-3.5 animate-spin" /> Leash intercepted the cart — inspecting every line…</div>}
            {job.state === "done" && <div className="text-emerald-400">✓ Cart handed off. Leash decided; see the firewall below.</div>}
            {job.state === "error" && <div className="text-red-400">✗ {job.error}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
