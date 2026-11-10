import { useCallback, useEffect, useState } from "react";
import { Bot, Check, FileJson, RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { api } from "./api";
import MandatePanel from "./components/MandatePanel";
import EscrowWidget from "./components/EscrowWidget";
import StorePanel from "./components/StorePanel";
import FirewallPanel from "./components/FirewallPanel";
import EventGrid from "./components/EventGrid";
import IsolationPanel from "./components/IsolationPanel";
import AuditModal from "./components/AuditModal";

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0f172a" />
      <path d="M10 9v11a4 4 0 0 0 4 4h8" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="24" r="2.5" fill="#10b981" />
    </svg>
  );
}

const STEPS = ["Mandate", "PayPal hold", "Agent shops", "Firewall", "Settlement"];

function currentStep(mandate, job, cart) {
  if (!mandate) return 0;
  if (mandate.status === "pending_approval") return 1;
  if (cart) return 4;
  if (job?.state === "running") return job.phase === "leash_checking" ? 3 : 2;
  return 2;
}

function Stepper({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`flex size-6 items-center justify-center rounded-full transition ${i < step ? "bg-ok text-white" : i === step ? "bg-ink text-white" : "bg-slate-200 text-ink-3"}`}>
            {i < step ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={i <= step ? "text-ink" : "text-ink-3"}>{s}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-300" />}
        </li>
      ))}
    </ol>
  );
}

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  return { mandateId: q.get("mandate"), returnError: q.get("error"), cancelled: q.get("cancelled") };
}

export default function App() {
  const [{ mandateId, returnError, cancelled }, setUrl] = useState(readUrl);
  const [health, setHealth] = useState(null);
  const [mandate, setMandate] = useState(null);
  const [cart, setCart] = useState(null);
  const [job, setJob] = useState(null);
  const [runError, setRunError] = useState(null);
  const [animateCart, setAnimateCart] = useState(false);
  const [settling, setSettling] = useState(false);
  const [approvedSoFar, setApprovedSoFar] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => { api.health().then(setHealth).catch(() => setHealth({ status: "down" })); }, []);

  useEffect(() => {
    if (!mandateId) return;
    let cancelledLoad = false;
    Promise.all([api.mandate(mandateId), api.carts(mandateId), api.shopStatus(mandateId)]).then(([m, c, s]) => {
      if (cancelledLoad) return;
      setMandate(m);
      setCart(c.carts.at(-1) || null);
      if (s.state !== "idle") setJob(s);
    }).catch(() => setMandate(null));
    return () => { cancelledLoad = true; };
  }, [mandateId]);

  // Poll the shopping job while it runs; when it finishes, replay the firewall decisions.
  const running = job?.state === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const s = await api.shopStatus(mandateId);
        setJob(s);
        if (s.state === "done") {
          setMandate(s.mandate); setApprovedSoFar(0); setSettling(true); setAnimateCart(true); setCart(s.cart);
          setRefreshKey((k) => k + 1);
        } else if (s.state === "error") {
          setRunError(s.error); setRefreshKey((k) => k + 1);
        }
      } catch { /* transient; keep polling */ }
    }, 900);
    return () => clearInterval(timer);
  }, [running, mandateId]);

  async function run(task, scenario) {
    setRunError(null); setCart(null); setAnimateCart(false);
    try { setJob(await api.startShop(mandateId, task, scenario)); }
    catch (e) { setRunError(e.message); }
  }

  async function revoke() {
    setMandate(await api.revoke(mandateId));
    setRefreshKey((k) => k + 1);
  }

  function reset() {
    window.history.replaceState(null, "", "/");
    setMandate(null); setCart(null); setJob(null); setRunError(null); setSettling(false); setApprovedSoFar(null);
    setUrl(readUrl());
  }

  const onProgress = useCallback((cents) => setApprovedSoFar(cents), []);
  const onDone = useCallback(() => { setSettling(false); setApprovedSoFar(null); }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight"><Logo /> Leash</div>
        <div className="flex flex-wrap items-center gap-2">
          {health && <span className={health.payments === "sandbox" ? "badge-ok" : "badge-warn"}><Wallet className="size-3.5" />
            {health.payments === "sandbox" ? "PayPal sandbox" : health.payments === "mock" ? "Payment simulator" : "Backend offline"}</span>}
          {health?.agent && <span className={health.agent === "separate_process" ? "badge-ok" : "badge-warn"}><Bot className="size-3.5" />
            {health.agent === "separate_process" ? "Agent isolated" : "Agent in-process"}</span>}
          {mandateId && <button className="btn-ghost !py-1.5" onClick={() => setShowAudit(true)}><FileJson className="size-4" /> Inspect raw audit log</button>}
          <button className="btn-ghost !py-1.5" onClick={reset}><RotateCcw className="size-4" /> Reset demo</button>
        </div>
      </header>

      <section className="flex flex-wrap items-end justify-between gap-6 pb-6 pt-4">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">Let AI shop.<br />Keep the leash.</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-2 sm:text-lg">
            One line of text on a product page can hijack a shopping agent. Leash makes that irrelevant:
            the agent only proposes, and a separate firewall captures from a PayPal hold sized to your exact budget, and only for what your rules allow.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-2">
          <ShieldCheck className="size-5 text-ok" /> The agent proposes. <b className="text-ink">Only Leash pays.</b>
        </div>
      </section>

      <div className="mb-5 card px-5 py-3.5"><Stepper step={currentStep(mandate, job, cart)} /></div>

      {returnError && <p className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad-ink">PayPal approval didn't complete: {returnError}</p>}
      {cancelled && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn-ink">The PayPal approval was cancelled or declined. No money was held.</p>}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-4"><MandatePanel mandate={mandate} onRevoke={revoke} /></div>
        <div className="lg:col-span-5"><StorePanel mandate={mandate} job={job} onRun={run} runError={runError} /></div>
        <div className="lg:col-span-3">
          <EscrowWidget mandate={mandate} cart={cart} payments={health?.payments} revealedApprovedCents={approvedSoFar} settling={settling} />
        </div>
      </div>

      {cart && mandate && (
        <div className="mt-5">
          <FirewallPanel key={cart.cart_id} cart={cart} policy={mandate.policy} animate={animateCart} onProgress={onProgress} onDone={onDone} />
        </div>
      )}

      <div className="mt-5 grid gap-5">
        <EventGrid mandateId={mandateId} refreshKey={refreshKey} live={running} />
        <IsolationPanel />
      </div>

      <footer className="mt-12 text-center text-xs text-ink-3">Sandbox only. No real money moves. Built for the PayPal AI Hackathon.</footer>

      {showAudit && mandateId && <AuditModal mandateId={mandateId} mandate={mandate} cart={cart} onClose={() => setShowAudit(false)} />}
    </div>
  );
}
