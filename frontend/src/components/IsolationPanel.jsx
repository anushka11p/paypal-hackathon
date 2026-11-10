import { useState } from "react";
import { Ban, Boxes, KeyRound, Loader2, ShieldCheck, Swords } from "lucide-react";
import { api } from "../api";

const WALLS = [
  [Boxes, "Build time", "The agent's code can't import the payment client (import-linter contract)."],
  [Ban, "Every call", "The payment client refuses any caller but the policy engine (call-stack guard)."],
  [KeyRound, "Process", "The agent runs as its own process with no PayPal credentials at all."],
];

export default function IsolationPanel() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function attack() {
    setBusy(true);
    try {
      const [hack, proof] = await Promise.all([api.attemptAgentHack(), api.isolationProof()]);
      setResult({ hack, proof });
    } finally { setBusy(false); }
  }

  const agent = result?.proof.agent;
  return (
    <section className="card card-pad">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Isolation proof</div>
          <h2 className="mt-1 text-lg font-semibold">Make the agent call PayPal directly</h2>
        </div>
        <button className="btn-ghost" onClick={attack} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />} Attempt it
        </button>
      </header>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {WALLS.map(([Icon, title, text]) => (
          <div key={title} className="rounded-xl border border-line bg-canvas/60 p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-ink-3" /> {title}</div>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">{text}</p>
          </div>
        ))}
      </div>
      {result && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 animate-rise">
          <div>
            <span className={result.hack.status === 403 ? "badge-ok" : "badge-bad"}>
              <ShieldCheck className="size-3.5" /> {result.hack.status === 403 ? "403: refused by the runtime guard" : `Unexpected ${result.hack.status}`}
            </span>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-black/55 p-3 font-mono text-[11px] text-slate-300">{result.hack.body.detail}</pre>
          </div>
          <div>
            <span className={agent?.isolated ? "badge-ok" : "badge-warn"}>
              <KeyRound className="size-3.5" /> {agent?.isolated ? "Agent process holds 0 payment secrets" : "Agent in-process (dev mode)"}
            </span>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-black/55 p-3 font-mono text-[11px] text-slate-300">{JSON.stringify(agent, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
