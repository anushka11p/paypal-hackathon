import { useState } from "react";
import { api } from "../api";

export default function IsolationPanel() {
  const [hack, setHack] = useState(null);
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const [h, p] = await Promise.all([api.attemptAgentHack(), api.isolationProof()]);
      setHack(h); setProof(p);
    } finally { setBusy(false); }
  }

  const agent = proof?.agent;
  return (
    <section className="step">
      <div className="step-head">
        <h2><span className="step-num">06</span>Try to make the agent pay directly</h2>
        <button className="btn ghost sm" onClick={run} disabled={busy}>{busy ? "Trying…" : "Attempt it"}</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Three independent walls: the agent's code can't import the payment client (checked at build time),
        the payment client refuses any caller but the policy engine (checked on every call), and the agent's
        process has no PayPal credentials at all.
      </p>
      {hack && (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div>
            <span className={`chip ${hack.status === 403 ? "ok" : "bad"}`}><span className="dot" />
              {hack.status === 403 ? "403 — refused by the runtime guard" : `Unexpected ${hack.status}`}</span>
            <div className="proof" style={{ marginTop: 8 }}>{hack.body.detail}</div>
          </div>
          <div>
            <span className={`chip ${agent?.isolated ? "ok" : "warn"}`}><span className="dot" />
              {agent?.isolated ? "Agent process holds no payment secrets" : "Agent runs in-process (dev mode)"}</span>
            <div className="proof" style={{ marginTop: 8 }}>{JSON.stringify(agent, null, 2)}</div>
          </div>
        </div>
      )}
    </section>
  );
}
