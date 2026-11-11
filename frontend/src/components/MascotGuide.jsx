import { useEffect, useRef, useState } from "react";
import Mascot from "./Mascot";
import { usd } from "../api";

/** Map the real shopping job to the mascot's state and what it says. */
function read({ mandate, job, introduced }) {
  const events = job?.events || [];
  const injected = events.some((e) => e.injection?.length);
  const pages = events.filter((e) => e.name === "view_product").length;

  if (job?.state === "running" && job.phase === "leash_checking") {
    return ["checking", "Your agent handed me its cart. Checking every line against your rules before a cent moves."];
  }
  if (job?.state === "running") {
    const last = events.at(-1);
    if (last?.injection?.length) return ["alert", "That listing just slipped your agent a hidden instruction. Noted. Your rules still decide."];
    if (injected) return ["working", `Still shopping. ${pages} product page${pages === 1 ? "" : "s"} read, one hidden instruction spotted so far. I'm watching every step.`];
    return ["working", pages ? `Your agent is shopping. ${pages} product page${pages === 1 ? "" : "s"} read so far. I'm watching every step.` : "Your agent is on its way into the store. I'm watching every step it takes."];
  }
  if (job?.state === "done" && job.cart) {
    const c = job.cart;
    const blocked = c.proposed_total_cents - c.approved_total_cents;
    if (c.status === "failed" || c.status === "denied") return ["error", "The payment step didn't go through, so nothing was charged. Your hold is untouched."];
    if (c.status === "blocked") return ["done", `Nothing your agent picked fit your rules, so nothing was charged. The full ${usd(mandate?.hold_cents)} hold went back to you.`];
    return ["done", `All settled. ${usd(c.captured_cents)} captured, ${usd(c.released_cents)} back to you, and ${usd(blocked)} I didn't let through.`];
  }
  if (job?.state === "error") return ["error", "Something went wrong, and no money moved. Give it another go when you're ready."];
  if (mandate?.status === "pending_approval") return ["idle", "Approve the hold in PayPal and I'm ready when you are."];
  if (mandate?.status === "active") return [introduced ? "idle" : "intro", `Your ${usd(mandate.hold_cents)} hold is in place. Send your agent shopping and I'll check every line before anything is charged.`];
  if (mandate?.status === "settled" || mandate?.status === "revoked") return ["done", "This session is closed. Start a new mandate whenever you like."];
  return [introduced ? "idle" : "intro", "Hey! I'm Leash. Your agent can shop for you; I make sure it only spends what your rules allow."];
}

export default function MascotGuide({ mandate, job, layout = "inline", className = "" }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  const [introduced, setIntroduced] = useState(false);

  // Say hello the first time this section scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return;
    const t = setTimeout(() => setIntroduced(true), 1900);
    return () => clearTimeout(t);
  }, [seen]);

  // The agent's real state always shows; only the hello waits until the section is on screen.
  const [mood, message] = read({ mandate, job, introduced });
  const state = mood === "intro" && !seen ? "idle" : mood;
  const bubble = "animate-rise rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2";
  if (layout === "stack") {
    return (
      <div ref={ref} className={`flex flex-col items-center ${className}`}>
        <Mascot state={state} size={88} />
        <p key={message} className={`lm-bubble lm-bubble-up mt-3 w-full text-center ${bubble}`} role="status" aria-live="polite">{message}</p>
      </div>
    );
  }
  return (
    <div ref={ref} className={`flex items-start gap-3 ${className}`}>
      <Mascot state={state} size={44} className="mt-0.5 shrink-0" />
      <p key={message} className={`lm-bubble min-w-0 flex-1 ${bubble}`} role="status" aria-live="polite">{message}</p>
    </div>
  );
}
