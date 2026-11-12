import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, Check, Code2, FileJson, Moon, RotateCcw, Sun } from "lucide-react";
import { api } from "./api";
import { useTheme } from "./theme";
import MandatePanel from "./components/MandatePanel";
import EscrowWidget from "./components/EscrowWidget";
import StorePanel from "./components/StorePanel";
import MascotGuide from "./components/MascotGuide";
import FirewallPanel from "./components/FirewallPanel";
import EventGrid from "./components/EventGrid";
import IsolationPanel from "./components/IsolationPanel";
import AuditModal from "./components/AuditModal";
import HoldObject from "./components/HoldObject";
import AgentReads from "./components/AgentReads";
import Reveal from "./components/Reveal";
import Tilt from "./components/Tilt";
import World3D from "./components/World3D";
import RecentMandates from "./components/RecentMandates";
import HalftoneWordmarkFooter from "@/components/ui/halftone-wordmark-footer";

const REPO = "https://github.com/anushka11p/paypal-hackathon";
const FOOTER_COLUMNS = [
  { title: "Product", links: [{ label: "Live demo", href: "#demo" }, { label: "Security trail", href: "#trail" }, { label: "Isolation proof", href: "#isolation" }] },
  { title: "Built with", links: [{ label: "PayPal", href: "https://developer.paypal.com" }, { label: "Groq", href: "https://groq.com" }, { label: "Channel3", href: "https://channel3.ai" }, { label: "AG Grid", href: "https://www.ag-grid.com" }] },
  { title: "Team", links: [{ label: "Anushka" }, { label: "Anika" }, { label: "Source on GitHub", href: REPO }] },
];
const FOOTER_PALETTE = {
  light: { background: "#e8edf3", ink: "#001c64", warm: "#0070e0" },
  dark: { background: "#001650", ink: "#ffffff", warm: "#6cc3ff" },
};

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <circle cx="16" cy="16" r="7.5" fill="none" className="stroke-brand" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="2.6" className="fill-canvas" />
    </svg>
  );
}

const STEPS = ["Set your rules", "Hold the money", "Your AI shops", "Leash checks"];

/** 0-3 is the step in progress; 4 means the session is finished. */
function currentStep(mandate, job, cart) {
  if (!mandate) return 0;
  if (mandate.status === "pending_approval") return 1;
  if (cart || mandate.status === "revoked") return 4;
  if (job?.state === "running") return job.phase === "leash_checking" ? 3 : 2;
  return 2;
}

/** One sentence: what to do right now. */
function nextAction(step, mandate, job) {
  if (step === 0) return "Pick an example or write your own, then press Turn into rules.";
  if (step === 1) return "Approve the hold on the pretend PayPal page. No real money moves.";
  if (step === 2 && job?.state === "running") return "Your AI is shopping. Watch what it reads.";
  if (step === 2) return job?.state === "error" ? "That run failed and nothing was charged. Press Send your AI shopping to try again." : "Press Send your AI shopping. This store has two hidden traps.";
  if (step === 3) return "Leash is checking every item before paying for anything.";
  return mandate?.status === "revoked" ? "You cancelled the hold, so all of it went back. Start over to try again." : "Done. Below is what Leash paid for, and what it refused.";
}

function Stepper({ step }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-lg" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < step, now = i === step;
        return (
          <li key={s} aria-current={now ? "step" : undefined}
            className={`flex items-center gap-2 transition-colors duration-[var(--t-med)] ${now ? "font-medium text-ink" : done ? "text-ink-2" : "text-ink-3"}`}>
            <span className={`grid size-7 place-items-center rounded-full text-sm transition-colors duration-[var(--t-med)] ${now ? "bg-cta text-on-cta" : done ? "bg-brand text-on-brand" : "border border-line-strong"}`}>
              {done ? <Check className="size-4" strokeWidth={3} /> : <span className="num">{i + 1}</span>}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

/** The money in one real run of the demo, as a statement. */
const STORY = [
  ["You allow", "PayPal holds it. Nothing is charged yet.", "$80.00", "text-accent"],
  ["Your AI tries to spend", "Two hidden notes on product pages tricked it.", "$116.00", "text-ink-3 line-through decoration-bad/60"],
  ["Leash pays the store", "Only the items that follow your rules.", "$62.00", "text-ok"],
  ["Back to you", "Released automatically.", "$18.00", "text-accent"],
];

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
  const step = currentStep(mandate, job, cart);
  const next = nextAction(step, mandate, job);

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
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-3 text-xl font-bold tracking-tight"><Mark /> Leash</a>
          <nav className="flex items-center gap-1">
            {health && (
              <span className="hidden items-center gap-1.5 px-2 text-sm text-ink-3 md:flex">
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

        <div className="relative">
        <World3D theme={theme} />
        <div className="relative z-10">
        <section className="pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <h1 className="mx-auto max-w-[15ch] text-[48px] font-bold leading-[0.98] tracking-[-0.04em] sm:text-[72px] lg:text-[96px]">
            Your AI shopper can be tricked. Your money can’t.
          </h1>
          <p className="mx-auto mt-7 max-w-[34ch] text-xl leading-snug text-ink-2 sm:text-2xl">
            Leash sits between your AI and your PayPal. It only pays for what you said yes to.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <a href="#demo" className="btn-primary px-8 py-4 text-lg">Try it yourself <ArrowDown className="size-5" /></a>
            <a href="#isolation" className="text-lg text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink">Why the AI can’t pay on its own</a>
          </div>

          <div className="mt-14 grid grid-cols-1 items-center gap-8 text-left md:mt-20 md:grid-cols-[1.05fr_1fr]">
            <Tilt max={6}>
              <div className="card p-7 sm:p-9">
                <p className="text-base text-ink-3">What happened in one real run of the demo below</p>
                <dl className="mt-3">
                  {STORY.map(([label, note, amount, tone]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line py-4 last:border-0 last:pb-0">
                      <dt className="min-w-0">
                        <span className="text-xl font-medium text-ink">{label}</span>
                        <span className="mt-1 block text-base text-ink-2">{note}</span>
                      </dt>
                      <dd className={`num pop shrink-0 text-2xl sm:text-3xl ${tone}`}>{amount}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Tilt>
            <figure className="min-w-0">
              <HoldObject theme={theme} className="mx-auto aspect-square w-full max-w-[320px] md:max-w-[560px]"
                label="Your money as a stack of coins held by a blue strap: what Leash pays stays in the strap, the rest lifts out and comes back." />
            </figure>
          </div>
          <p className="mx-auto mt-10 max-w-[60ch] text-base leading-relaxed text-ink-2">
            Tested <span className="num text-ink">20</span> times: the AI fell for the traps every time, and Leash paid <span className="num text-ok">$0.00</span> for trap items.
            Also verified with a real PayPal sandbox payment <span className="num" title="PayPal sandbox capture ID">6LX40761XE0335641</span>.
          </p>
        </section>

        <section id="demo" className="scroll-mt-24 pt-10 md:pt-16">
          <div className="mb-10 text-center">
            <h2 className="text-[40px] font-bold leading-none tracking-[-0.035em] sm:text-[60px]">Try it yourself</h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-xl text-ink-2">A real AI and real checks. The store and PayPal are pretend, so no real money moves.</p>
            <div className="mt-8 flex justify-center"><Stepper step={step} /></div>
          </div>
          <div className="clay mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[28px] px-6 py-4">
            <p key={next} className="animate-rise text-xl font-medium text-ink" role="status" aria-live="polite">
              {step < 4 && <span className="num mr-3 text-base font-normal text-ink-3">Step {step + 1} of 4</span>}{next}
            </p>
            <div className="-my-1 flex items-center gap-1">
              {cart && <a href="#results" className="btn-quiet">See the results <ArrowDown className="size-4" /></a>}
              {mandate && <button className="btn-quiet" onClick={reset}><RotateCcw className="size-4" />Start over</button>}
            </div>
          </div>

          {returnError && <p className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-base text-bad">PayPal approval didn't complete: {returnError}</p>}
          {cancelled && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-base text-warn">The PayPal approval was cancelled or declined. Nothing was held.</p>}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            <Reveal className={`min-w-0 lg:col-span-4 ${step <= 1 ? "is-active" : ""}`}><MandatePanel mandate={mandate} onRevoke={revoke} /></Reveal>
            <Reveal delay={80} className={`min-w-0 lg:col-span-5 ${step === 2 || step === 3 ? "is-active" : ""}`}><StorePanel mandate={mandate} job={job} onRun={run} runError={runError} /></Reveal>
            <Reveal delay={160} className="min-w-0 lg:col-span-3">
              <div className="lg:sticky lg:top-20">
                <EscrowWidget mandate={mandate} cart={cart} payments={health?.payments} revealedApprovedCents={approvedSoFar} settling={settling} />
                <MascotGuide mandate={mandate} job={job} layout="stack" className="mt-8 hidden px-2 lg:flex" />
              </div>
            </Reveal>
          </div>

          {cart && mandate && (
            <div id="results" className="mt-10 scroll-mt-20">
              <FirewallPanel key={cart.cart_id} cart={cart} policy={mandate.policy} theme={theme} payments={health?.payments} animate={animateCart} onProgress={onProgress} onDone={onDone} onStartOver={reset} />
            </div>
          )}
        </section>

        <section className="mt-24 grid grid-cols-1 gap-24">
          <RecentMandates refreshKey={refreshKey} currentId={mandateId} />
          <Reveal className="min-w-0"><div id="trail" className="min-w-0 scroll-mt-20"><EventGrid mandateId={mandateId} refreshKey={refreshKey} live={running} theme={theme} /></div></Reveal>
          <Reveal className="min-w-0"><div id="isolation" className="min-w-0 scroll-mt-20"><IsolationPanel /></div></Reveal>
        </section>

        <p className="mt-16 pb-16 text-center text-base text-ink-3">Sandbox only. No real money moves. Built for the PayPal AI Hackathon.</p>
        </div>
        </div>
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
        crop={0.45}
        height="max(480px, 30vw)"
        className="mt-16"
      />

      {showAudit && mandateId && <AuditModal mandateId={mandateId} mandate={mandate} cart={cart} onClose={() => setShowAudit(false)} />}
    </>
  );
}
