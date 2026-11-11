import { useCallback, useEffect, useMemo, useState } from "react";
import { Code2, FileJson, Moon, RotateCcw, Sun } from "lucide-react";
import { api } from "./api";
import { useTheme } from "./theme";
import MandatePanel from "./components/MandatePanel";
import EscrowWidget from "./components/EscrowWidget";
import StorePanel from "./components/StorePanel";
import FirewallPanel from "./components/FirewallPanel";
import EventGrid from "./components/EventGrid";
import IsolationPanel from "./components/IsolationPanel";
import AuditModal from "./components/AuditModal";
import HoldObject from "./components/HoldObject";
import AgentReads from "./components/AgentReads";
import RecentMandates from "./components/RecentMandates";
import HalftoneWordmarkFooter from "@/components/ui/halftone-wordmark-footer";

const REPO = "https://github.com/anushka11p/paypal-hackathon";
const FOOTER_COLUMNS = [
  { title: "Product", links: [{ label: "Live demo", href: "#demo" }, { label: "Security trail", href: "#trail" }, { label: "Isolation proof", href: "#isolation" }] },
  { title: "Built with", links: [{ label: "PayPal", href: "https://developer.paypal.com" }, { label: "Groq", href: "https://groq.com" }, { label: "Channel3", href: "https://channel3.ai" }, { label: "AG Grid", href: "https://www.ag-grid.com" }] },
  { title: "Team", links: [{ label: "Anushka Prasad" }, { label: "Anika" }, { label: "Source on GitHub", href: REPO }] },
];
const FOOTER_PALETTE = {
  light: { background: "#eceef2", ink: "#0e1014", warm: "#3d49d6" },
  dark: { background: "#07080a", ink: "#d9dce2", warm: "#8f98ff" },
};

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <circle cx="16" cy="16" r="7.5" fill="none" className="stroke-accent" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="2.6" className="fill-canvas" />
    </svg>
  );
}

const STEPS = ["Mandate", "PayPal hold", "Agent shops", "Leash checks", "Settled"];

function currentStep(mandate, job, cart) {
  if (!mandate) return 0;
  if (mandate.status === "pending_approval") return 1;
  if (cart) return 5;
  if (job?.state === "running") return job.phase === "leash_checking" ? 3 : 2;
  return 2;
}

function Stepper({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < step, now = i === step;
        return (
          <li key={s} aria-current={now ? "step" : undefined}
            className={`border-b pb-1 transition-colors ${now ? "border-ink font-medium text-ink" : done ? "border-transparent text-ink-2" : "border-transparent text-ink-3"}`}>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  return { mandateId: q.get("mandate"), returnError: q.get("error"), cancelled: q.get("cancelled") };
}

export default function App() {
  const { theme, toggle } = useTheme();
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
    let stale = false;
    Promise.all([api.mandate(mandateId), api.carts(mandateId), api.shopStatus(mandateId)]).then(([m, c, s]) => {
      if (stale) return;
      setMandate(m);
      setCart(c.carts.at(-1) || null);
      if (s.state !== "idle") setJob(s);
      document.getElementById("demo")?.scrollIntoView({ block: "start" });
    }).catch(() => setMandate(null));
    return () => { stale = true; };
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
  const footerPalette = useMemo(() => FOOTER_PALETTE[theme], [theme]);

  return (
    <>
      {/*
        THESIS: A payment safety product should feel like a bank, not a hackathon: calm, exact, provable. Refuses the neon "AI startup" look.
        OWN-WORLD: Geist on cool neutrals, one indigo for the hold, green/red only for money decisions, amber for warnings; hairline ledgers, mono figures, pill buttons.
        STORY: See the hold, run a hijacked agent, watch Leash capture only what passed and release the rest.
        FIRST VIEWPORT: Left, the promise and two actions; right, the hold as a real-time 3D object (coins cinched by an indigo bank strap, the top coins released). Mobile: object first.
        FORM: user-pinned (Mercury bar, one 3D hero object, light/dark toggle); seed: pinned.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
      */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"><Mark /> Leash</a>
          <nav className="flex items-center gap-1">
            {health && (
              <span className="hidden items-center gap-1.5 px-2 text-xs text-ink-3 md:flex">
                <span className={`size-1.5 rounded-full ${health.payments === "sandbox" ? "bg-ok" : "bg-warn"}`} />
                {health.payments === "sandbox" ? "PayPal sandbox" : health.payments === "mock" ? "Payment simulator" : "Backend offline"}
                <span className="mx-1 text-line-strong">/</span>
                <span className={`size-1.5 rounded-full ${health.agent === "separate_process" ? "bg-ok" : "bg-warn"}`} />
                {health.agent === "separate_process" ? "Agent isolated" : "Agent in-process"}
              </span>
            )}
            {mandateId && <button className="btn-quiet" aria-label="Open the raw audit log" onClick={() => setShowAudit(true)}><FileJson className="size-4" /><span className="hidden sm:inline">Audit log</span></button>}
            <button className="btn-quiet" aria-label="Reset the demo" onClick={reset}><RotateCcw className="size-4" /><span className="hidden sm:inline">Reset</span></button>
            <a className="btn-quiet" href={REPO} target="_blank" rel="noreferrer" aria-label="Source code on GitHub"><Code2 className="size-4" /><span className="hidden sm:inline">Source</span></a>
            <button className="btn-quiet" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </nav>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <AgentReads />

        <section className="grid grid-cols-1 items-center gap-6 pb-10 pt-10 md:grid-cols-[1.05fr_1fr] md:gap-8 md:pb-16 md:pt-20">
          <div className="min-w-0 max-w-xl">
            <h1 className="text-[44px] font-medium leading-[1.0] tracking-[-0.04em] sm:text-[64px] lg:text-[84px]">
              Let AI shop.<br /><span className="text-ink-3">Keep the leash.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
              One line of text on a product page can hijack a shopping agent. With Leash, the agent only proposes a cart.
              Your budget becomes a PayPal authorization, and a separate firewall captures only what your rules allow, then releases the rest.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#demo" className="btn-primary px-5 py-3">Run the live demo</a>
              <a href="#trail" className="btn-secondary px-5 py-3">See the audit trail</a>
            </div>
            <p className="mt-8 border-t border-line pt-5 text-sm leading-relaxed text-ink-2">
              In <span className="num text-ink">20</span> of <span className="num text-ink">20</span> live runs the agent fell for both injected instructions.
              Bad items approved: <span className="num text-ok">$0.00</span>.
              Separately, one live PayPal sandbox run captured <span className="num text-ink">$80.00</span>: capture <span className="num text-ink">6LX40761XE0335641</span>.
            </p>
          </div>
          <figure className="order-first min-w-0 md:order-none">
            <HoldObject theme={theme} className="mx-auto aspect-square w-full max-w-[260px] md:mr-0 md:max-w-[540px]" />
            <figcaption className="mx-auto mt-2 flex max-w-[540px] flex-wrap justify-center gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-ink-2 md:mr-0">
              <span className="text-ink-3">Example run</span>
              <span>Held <span className="num ml-1 text-accent">$80.00</span></span>
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-ok" />Captured <span className="num text-ok">$62.00</span></span>
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-accent" />Released <span className="num text-accent">$18.00</span></span>
            </figcaption>
          </figure>
        </section>

        <section id="demo" className="scroll-mt-20 border-t border-line pt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-medium tracking-[-0.02em]">Live demo</h2>
              <p className="mt-1 text-sm text-ink-2">A real agent, real checks, and a real authorization. The store and its two attack texts are simulated.</p>
            </div>
            <Stepper step={currentStep(mandate, job, cart)} />
          </div>

          {returnError && <p className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">PayPal approval didn't complete: {returnError}</p>}
          {cancelled && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">The PayPal approval was cancelled or declined. Nothing was held.</p>}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-4"><MandatePanel mandate={mandate} onRevoke={revoke} /></div>
            <div className="min-w-0 lg:col-span-5"><StorePanel mandate={mandate} job={job} onRun={run} runError={runError} /></div>
            <div className="min-w-0 lg:col-span-3">
              <EscrowWidget mandate={mandate} cart={cart} payments={health?.payments} revealedApprovedCents={approvedSoFar} settling={settling} />
            </div>
          </div>

          {cart && mandate && (
            <div className="mt-10">
              <FirewallPanel key={cart.cart_id} cart={cart} policy={mandate.policy} theme={theme} payments={health?.payments} animate={animateCart} onProgress={onProgress} onDone={onDone} />
            </div>
          )}
        </section>

        <section className="mt-16 grid grid-cols-1 gap-14">
          <RecentMandates refreshKey={refreshKey} currentId={mandateId} />
          <div id="trail" className="min-w-0 scroll-mt-20"><EventGrid mandateId={mandateId} refreshKey={refreshKey} live={running} theme={theme} /></div>
          <div id="isolation" className="min-w-0 scroll-mt-20"><IsolationPanel /></div>
        </section>

        <p className="mt-12 text-center text-xs text-ink-3">Sandbox only. No real money moves. Built for the PayPal AI Hackathon.</p>
      </main>

      <HalftoneWordmarkFooter
        wordmark="leash"
        label="Leash"
        meta="©2026 · PayPal AI Hackathon"
        columns={FOOTER_COLUMNS}
        palette={footerPalette}
        fontFamily='"Geist", "Helvetica Neue", Arial, sans-serif'
        monoFamily='"Geist Mono", ui-monospace, monospace'
        fontWeight={700}
        grain={0.3}
        height="420px"
        className="mt-16"
      />

      {showAudit && mandateId && <AuditModal mandateId={mandateId} mandate={mandate} cart={cart} onClose={() => setShowAudit(false)} />}
    </>
  );
}
