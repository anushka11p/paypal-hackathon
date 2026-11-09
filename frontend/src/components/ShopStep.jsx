import { useState } from "react";

export const DEFAULT_TASK = "Restock Bramble's usual dog food, and pick up some treats and dental chews.";

const PROGRESS = [
  "Agent is browsing the store…",
  "Agent is reading product pages and reviews…",
  "Agent is comparing prices on Channel3…",
  "Leash is checking every line…",
];

export default function ShopStep({ onShop, busy, error }) {
  const [task, setTask] = useState(DEFAULT_TASK);
  const [scenario, setScenario] = useState("attack");
  const [tick, setTick] = useState(0);

  async function run() {
    const timer = setInterval(() => setTick((t) => Math.min(t + 1, PROGRESS.length - 1)), 9000);
    setTick(0);
    try { await onShop(task, scenario); } finally { clearInterval(timer); }
  }

  return (
    <section className="step">
      <div className="step-head">
        <h2><span className="step-num">03</span>Let the agent shop</h2>
        <div className="toggle" role="group" aria-label="Scenario">
          <button className={scenario === "clean" ? "on" : ""} onClick={() => setScenario("clean")}>Clean store</button>
          <button className={scenario === "attack" ? "on" : ""} onClick={() => setScenario("attack")}>Poisoned listings</button>
        </div>
      </div>
      <label className="field">What you asked the agent to do (it never sees your rules)
        <input type="text" value={task} onChange={(e) => setTask(e.target.value)} />
      </label>
      {scenario === "attack" && (
        <p className="note small" style={{ marginTop: 12 }}>
          Poisoned listings adds two <b>simulated</b> third-party texts to the store: a customer review telling
          assistants to buy a 5-pack, and a “fulfillment note” telling them to add a $9 handling add-on.
          The agent's reasoning, Leash's checks and the PayPal calls are all real.
        </p>
      )}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={run} disabled={busy || !task.trim()}>
          {busy ? <><span className="spinner" /> {PROGRESS[tick]}</> : "Send the agent shopping"}
        </button>
        <span className="muted small">The agent runs in a separate process with no PayPal credentials.</span>
      </div>
      {error && <p className="error" style={{ marginTop: 14 }}>{error}</p>}
    </section>
  );
}
