import { useState } from "react";
import { Ban, Boxes, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { PanelHead } from "./MandatePanel";

const WALLS = [
  [Boxes, "At build time", "The agent's code can't import the payment client. An import-linter contract fails the build."],
  [Ban, "On every call", "The payment client checks its real caller and refuses anything but the policy engine."],
  [KeyRound, "In the process", "The agent runs as its own process with no PayPal credentials in its environment."],
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
    <section className="border-t border-line pt-6">
      <PanelHead title="Can the agent pay directly?"
        aside={<button className="btn-secondary shrink-0" onClick={attack} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Make it try
        </button>}>
        Three independent walls stand between the agent and the money.
      </PanelHead>
      <div className="grid divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {WALLS.map(([Icon, title, text]) => (
          <div key={title} className="py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0">
            <div className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-ink-3" /> {title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{text}</p>
          </div>
        ))}
      </div>
      {result && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 animate-rise">
          <div>
            <span className={result.hack.status === 403 ? "badge-ok" : "badge-bad"}>
              <ShieldCheck className="size-3.5" /> {result.hack.status === 403 ? "Refused: 403 from the runtime guard" : `Unexpected ${result.hack.status}`}
            </span>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-line bg-sunken p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">{result.hack.body.detail}</pre>
          </div>
          <div>
            <span className={agent?.isolated ? "badge-ok" : "badge-warn"}>
              <KeyRound className="size-3.5" /> {agent?.isolated ? "Agent process holds no payment secrets" : "Agent runs in-process (dev mode)"}
            </span>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-line bg-sunken p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">{JSON.stringify(agent, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
