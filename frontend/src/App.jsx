import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import MandateStep from "./components/MandateStep";
import HoldCard from "./components/HoldCard";
import ShopStep from "./components/ShopStep";
import ResultPanel from "./components/ResultPanel";
import EventGrid from "./components/EventGrid";
import IsolationPanel from "./components/IsolationPanel";
import CatalogPanel from "./components/CatalogPanel";

function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M10 9v11a4 4 0 0 0 4 4h8" fill="none" stroke="var(--paper)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="24" r="2.5" fill="var(--paper)" /></svg>
  );
}

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  return { mandateId: q.get("mandate"), error: q.get("error"), cancelled: q.get("cancelled") };
}

export default function App() {
  const [{ mandateId, error: returnError, cancelled }, setUrl] = useState(readUrl);
  const [health, setHealth] = useState(null);
  const [mandate, setMandate] = useState(null);
  const [cart, setCart] = useState(null);
  const [shopping, setShopping] = useState(false);
  const [shopError, setShopError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { api.health().then(setHealth).catch(() => setHealth({ status: "down" })); }, []);

  const load = useCallback(async () => {
    if (!mandateId) return;
    const [m, c] = await Promise.all([api.mandate(mandateId), api.carts(mandateId)]);
    setMandate(m);
    setCart(c.carts.at(-1) || null);
  }, [mandateId]);

  useEffect(() => { load().catch(() => setMandate(null)); }, [load]);

  async function shop(task, scenario) {
    setShopping(true); setShopError(null);
    try {
      const res = await api.shop(mandateId, task, scenario);
      setCart(res.cart); setMandate(res.mandate);
    } catch (e) { setShopError(e.message); }
    finally { setShopping(false); setRefreshKey((k) => k + 1); }
  }

  async function revoke() {
    setMandate(await api.revoke(mandateId));
    setRefreshKey((k) => k + 1);
  }

  function startOver() {
    window.history.replaceState(null, "", "/");
    setMandate(null); setCart(null);
    setUrl(readUrl());
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand"><Logo />Leash</div>
        <div className="chips">
          {health && (
            <span className={`chip ${health.payments === "sandbox" ? "ok" : "warn"}`}><span className="dot" />
              {health.payments === "sandbox" ? "PayPal sandbox" : health.payments === "mock" ? "Payment simulator" : "Backend offline"}</span>
          )}
          {health?.agent && (
            <span className={`chip ${health.agent === "separate_process" ? "ok" : "warn"}`}><span className="dot" />
              {health.agent === "separate_process" ? "Agent isolated" : "Agent in-process (dev)"}</span>
          )}
          {mandateId && <button className="btn ghost sm" onClick={startOver}>New mandate</button>}
        </div>
      </header>

      <section className="hero">
        <h1>Let AI shop.<br />Keep the leash.</h1>
        <p>Your AI agent can be tricked by one line of text on a product page. Leash makes that irrelevant:
          the agent only proposes, and a separate service captures from a PayPal hold sized to your exact budget —
          only for what your rules allow.</p>
        <div className="invariant">
          <span className="chip"><b>Agent</b>&nbsp;proposes</span>
          <span className="chip"><b>Leash</b>&nbsp;checks every line</span>
          <span className="chip"><b>PayPal</b>&nbsp;captures only what passed</span>
        </div>
      </section>

      {returnError && <p className="error">PayPal approval didn't complete: {returnError}</p>}
      {cancelled && <p className="note">You cancelled the PayPal approval. No hold was placed.</p>}

      {!mandateId && <MandateStep />}
      {mandate && <HoldCard mandate={mandate} onRevoke={revoke} />}
      {mandate?.status === "active" && <ShopStep onShop={shop} busy={shopping} error={shopError} />}
      {cart && <ResultPanel cart={cart} />}
      <EventGrid mandateId={mandateId} refreshKey={refreshKey} live={shopping} />
      <IsolationPanel />
      <CatalogPanel />

      <footer>Sandbox only — no real money moves. Built for the PayPal AI Hackathon.</footer>
    </div>
  );
}
