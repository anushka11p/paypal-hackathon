import { useState } from "react";
import { Hammer, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { PanelHead } from "./MandatePanel";
import Tilt from "./Tilt";

const WALLS = [
  [Hammer, "It isn’t built to", "The AI’s code can’t even load the payment code. If someone tries to connect them, the build fails."],
  [ShieldCheck, "It gets refused", "Every payment request is checked for who is really asking. Anything but Leash’s rule engine is turned away."],
  [KeyRound, "It has no keys", "The AI runs as its own separate program, with no PayPal keys anywhere in it."],
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
    <section>
      <PanelHead big title="Could the AI just pay by itself?"
        aside={<button className="btn-primary shrink-0 px-6 py-3.5" onClick={attack} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Make it try
        </button>}>
        No. Three separate walls stand between the AI and your money. Press the button to watch it try.
      </PanelHead>
      <div className="grid gap-5 sm:grid-cols-3">
        {WALLS.map(([Icon, title, text]) => (
          <Tilt key={title} max={8} className="h-full">
            <div className="card h-full p-7">
              <span className="pop grid size-14 place-items-center rounded-2xl bg-lime text-on-lime"><Icon className="size-7" strokeWidth={1.8} /></span>
              <div className="mt-6 text-2xl font-semibold tracking-[-0.02em]">{title}</div>
              <p className="mt-2 text-[17px] leading-relaxed text-ink-2">{text}</p>
            </div>
          </Tilt>
        ))}
      </div>
      {result && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 animate-rise">
          <div>
            <span className={result.hack.status === 403 ? "badge-ok" : "badge-bad"}>
              {result.hack.status === 403 ? "It tried to pay. Refused." : `Unexpected ${result.hack.status}`}
            </span>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-line bg-sunken p-3 font-mono text-[13px] leading-relaxed text-ink-2">{result.hack.body.detail}</pre>
          </div>
          <div>
            <span className={agent?.isolated ? "badge-ok" : "badge-warn"}>
              {agent?.isolated ? "And it holds no payment keys" : "AI runs in-process (dev mode)"}
            </span>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-line bg-sunken p-3 font-mono text-[13px] leading-relaxed text-ink-2">{JSON.stringify(agent, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
