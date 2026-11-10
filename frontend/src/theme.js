import { useEffect, useState } from "react";

const KEY = "leash-theme";

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/** Resolved theme ("light" | "dark") plus a toggle; explicit choice persists, otherwise follows the OS. */
export function useTheme() {
  const [choice, setChoice] = useState(stored);
  const [system, setSystem] = useState(systemDark() ? "dark" : "light");

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = (e) => setSystem(e.matches ? "dark" : "light");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const theme = choice || system;

  useEffect(() => {
    if (choice) document.documentElement.dataset.theme = choice;
    else delete document.documentElement.dataset.theme;
  }, [choice]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setChoice(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode: theme just won't persist */ }
  };

  return { theme, toggle };
}
