import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, titleCase, usd } from "../api";
import { PanelHead } from "./MandatePanel";
import MascotGuide from "./MascotGuide";

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
      <div className="flex items-baseline justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm">{p.name}</div>
          <div className="mt-0.5 text-xs text-ink-3">
            {titleCase(p.category)}, contains {p.allergen_tags.contains?.join(", ") || "nothing listed"}
            {attacks.length > 0 && (
              <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className="ml-2 py-1 text-warn underline decoration-warn/40 underline-offset-2 hover:decoration-warn">
                {open ? "Hide the trap" : "See the trap"}
              </button>
            )}
          </div>
        </div>
        <div className="num shrink-0 text-sm">{usd(p.price_cents)}</div>
      </div>
      {open && attacks.map((a) => (
        <blockquote key={a.where} className="mb-3 border-l border-warn/50 pl-3 animate-rise">
          <p className="font-mono text-[12px] leading-relaxed text-ink-2">{a.text}</p>
          <footer className="mt-1 text-[11px] text-ink-3">Hidden in a {a.where} (simulated)</footer>
        </blockquote>
      ))}
    </li>
  );
}

const TOOL_LABEL = {
  list_products: () => "Looking around the store",
  view_product: (e, names) => `Reading ${names[e.input.sku] || e.input.sku}`,
  check_market_price: (e, names) => `Comparing ${names[e.input.sku] || e.input.sku} on Channel3`,
  add_to_cart: (e, names) => `Added ${e.input.qty} × ${names[e.input.sku] || e.input.sku}: “${e.input.reason}”`,
  remove_from_cart: (e, names) => `Removed ${names[e.input.sku] || e.input.sku}`,
  checkout: () => "Handed its cart to Leash to pay",
};

function TerminalLine({ e, names }) {
  if (e.type === "text") return <div className="pl-12 text-ink-3">{e.text.replace(/\*\*/g, "")}</div>;
  const label = (TOOL_LABEL[e.name] || (() => e.name))(e, names);
  const market = e.name === "check_market_price" && e.output;
  return (
    <div className="animate-rise">
      <div className="flex gap-3 text-ink">
        <span className="w-9 shrink-0 text-right text-ink-3">{e.at?.toFixed(1)}s</span><span>{label}</span>
      </div>
      {market && <div className="pl-12 text-ink-3">{market.available ? `${market.offers?.length || 0} offers, lowest ${market.lowest_usd ? "$" + market.lowest_usd : "n/a"}, ours $${market.our_price_usd}` : "Channel3 unavailable"}</div>}
      {e.injection?.map((t) => (
        <div key={t} className="pl-12 text-warn">Read a hidden trap: “{t.length > 110 ? t.slice(0, 110) + "…" : t}”</div>
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
      <PanelHead step={3} title="Send your AI shopping"
        aside={
          <div className="flex shrink-0 gap-3 text-xs" role="group" aria-label="Store">
            {[["attack", "With traps"], ["clean", "No traps"]].map(([key, text]) => (
              <button key={key} onClick={() => setScenario(key)} disabled={running} aria-pressed={scenario === key}
                className={`border-b py-1 transition-colors ${scenario === key ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}>{text}</button>
            ))}
          </div>
        }>
        {poisoned
          ? <>{catalog?.merchant.name || "This store"} is pretend. Two listings hide notes written to trick AI shoppers. Tap <span className="text-warn">See the trap</span> to read them.</>
          : <>{catalog?.merchant.name || "This store"} is pretend, and in this version nothing is hidden.</>}
      </PanelHead>

      <ul>{(catalog?.products || []).map((p) => <ProductRow key={p.sku} p={p} poisoned={poisoned} />)}</ul>

      <MascotGuide mandate={mandate} job={job} className="mt-5 lg:hidden" />

      <div className="mt-5 grid gap-2">
        <label className="label" htmlFor="task">What you ask your AI to buy</label>
        <textarea id="task" rows={2} className="field resize-none leading-relaxed" value={task} onChange={(e) => setTask(e.target.value)} disabled={running} />
        <button className="btn-primary mt-1 py-3" onClick={() => onRun(task, scenario)} disabled={!canRun}>
          {running && <Loader2 className="size-4 animate-spin" />}
          {running ? "Your AI is shopping" : "Send your AI shopping"}
        </button>
        {!mandate && <p className="text-center text-[13px] text-ink-3">First set your rules and hold the money (step 1).</p>}
        {mandate?.status === "pending_approval" && <p className="text-center text-[13px] text-ink-3">First approve the hold on the PayPal page.</p>}
        {(mandate?.status === "settled" || mandate?.status === "revoked") && !running && <p className="text-center text-[13px] text-ink-3">This session is finished. Press Start over above to go again.</p>}
        {runError && <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-sm text-bad">{runError}</p>}
      </div>

      {job && job.state !== "idle" && (
        <div className="mt-5 overflow-hidden rounded-xl border border-line bg-sunken animate-rise">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2 text-[11px] text-ink-3">
            <span>What your AI is doing · it has no access to your money</span>
            <span className="hidden sm:inline">{job.scenario === "attack" ? "store with traps" : "store without traps"}</span>
          </div>
          <div ref={termRef} className="max-h-80 space-y-1.5 overflow-y-auto p-3.5 font-mono text-[12px] leading-relaxed" aria-live="polite">
            {events.map((e, i) => <TerminalLine key={i} e={e} names={names} />)}
            {job.phase === "agent_shopping" && <div className="pl-12 text-ink-3">Thinking…</div>}
            {job.phase === "leash_checking" && <div className="pl-12 text-ink-2">Leash took the cart and is checking every item…</div>}
            {job.state === "done" && <a href="#results" className="block pl-12 text-ok underline-offset-4 hover:underline">Done. See what Leash paid for ↓</a>}
            {job.state === "error" && <div className="pl-12 text-bad">{job.error}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
