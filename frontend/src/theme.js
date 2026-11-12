import { useEffect, useState } from "react";

const KEY = "leash-theme";

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/** Resolved theme ("light" | "dark") plus a toggle. Light is the default; a visitor's own choice persists. */
export function useTheme() {
  const [theme, setTheme] = useState(() => stored() || "light");

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode: theme just won't persist */ }
  };

  return { theme, toggle };
}
