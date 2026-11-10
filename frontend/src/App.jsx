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
import FluffyOrbs from "./components/FluffyOrbs";
import HalftoneWordmarkFooter from "@/components/ui/halftone-wordmark-footer";

const REPO = "https://github.com/anushka11p/paypal-hackathon";
const FOOTER_COLUMNS = [
  { title: "Product", links: [{ label: "Live demo", href: "#top" }, { label: "Security trail", href: "#trail" }, { label: "Isolation proof", href: "#isolation" }] },
  { title: "Built with", links: [{ label: "PayPal", href: "https://developer.paypal.com" }, { label: "Groq", href: "https://groq.com" }, { label: "Channel3", href: "https://channel3.ai" }, { label: "AG Grid", href: "https://www.ag-grid.com" }] },
  { title: "Team", links: [{ label: "Anushka Prasad" }, { label: "Anika" }, { label: "Source on GitHub", href: REPO }] },
];

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 drop-shadow-[0_0_12px_rgb(244_114_182/0.5)]" aria-hidden="true">
      <defs><radialGradient id="lg" cx="50%" cy="30%" r="75%"><stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#f9c6dd" /><stop offset="1" stopColor="#ec4899" /></radialGradient></defs>
      <rect width="32" height="32" rx="10" fill="url(#lg)" />
      <path d="M11 9v11a4 4 0 0 0 4 4h7" fill="none" stroke="#4a2140" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="24" r="2.4" fill="#4a2140" />
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
          <span className={`flex size-6 items-center justify-center rounded-full transition ${i < step ? "bg-ok text-canvas" : i === step ? "bg-blush text-canvas" : "bg-surface-2 text-ink-3"}`}>
            {i < step ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={i <= step ? "text-ink" : "text-ink-3"}>{s}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-white/15" />}
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
    <>
    <div id="top" className="mx-auto max-w-[1400px] px-4 pb-6 sm:px-6">
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

      <section className="grid items-center gap-6 pb-8 pt-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">
            Let AI shop.<br /><span className="bg-gradient-to-r from-blush via-pink to-pink-2 bg-clip-text text-transparent">Keep the leash.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2 sm:text-lg">
            One line of text on a product page can hijack a shopping agent. Leash makes that irrelevant:
            the agent only proposes, and a separate firewall captures from a PayPal hold sized to your exact budget, and only for what your rules allow.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink-2">
            <ShieldCheck className="size-4 text-pink" /> The agent proposes. <b className="text-ink">Only Leash pays.</b>
          </div>
        </div>
        <FluffyOrbs size={300} className="mx-auto hidden md:block" />
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
        <div id="trail" className="scroll-mt-6"><EventGrid mandateId={mandateId} refreshKey={refreshKey} live={running} /></div>
        <div id="isolation" className="scroll-mt-6"><IsolationPanel /></div>
      </div>

      <p className="mt-10 text-center text-xs text-ink-3">Sandbox only. No real money moves. Built for the PayPal AI Hackathon.</p>

      {showAudit && mandateId && <AuditModal mandateId={mandateId} mandate={mandate} cart={cart} onClose={() => setShowAudit(false)} />}
    </div>
    <HalftoneWordmarkFooter
      wordmark="leash"
      label="Leash"
      meta="©2026 · PayPal AI Hackathon"
      columns={FOOTER_COLUMNS}
      palette={{ background: "#0d0a11", ink: "#f3d9e6", warm: "#ec4899" }}
      fontFamily='"Inter", "Helvetica Neue", Arial, sans-serif'
      height="440px"
      className="mt-16"
    />
    </>
  );
}
