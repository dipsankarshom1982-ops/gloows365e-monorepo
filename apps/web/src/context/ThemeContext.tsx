"use client";

// PATH: apps/web/src/context/ThemeContext.tsx
// Syncs theme to CSS variables on <html> so ALL pages update automatically.
// Any element using var(--bg), var(--text), var(--accent) etc. reacts instantly.

import * as React from "react";

export const lightColors = {
  background:    "#ffffff",
  text:          "#1f2937",
  textSecondary: "#6b7280",
  accent:        "#3b82f6",
  card:          "#f3f4f6",
  border:        "#e5e7eb",
};

export const darkColors = {
  background:    "#0f172a",
  text:          "#e2e8f0",
  textSecondary: "#94a3b8",
  accent:        "#38bdf8",
  card:          "#1e293b",
  border:        "rgba(56, 189, 248, 0.15)",
};

export type Colors = typeof darkColors;

interface CtxType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: Colors;
}

const ThemeContext = React.createContext<CtxType>({
  isDarkMode: false,
  toggleTheme: () => {},
  colors: lightColors,
});

export const useTheme = () => React.useContext(ThemeContext);

// ─── Apply theme tokens as CSS variables on <html> ────────────
// This is the key function — every page using var(--bg) etc. updates for free.
function applyThemeVars(isDark: boolean) {
  const c   = isDark ? darkColors : lightColors;
  const acc = isDark ? "#38bdf8" : "#3b82f6";
  const el  = document.documentElement;

  el.setAttribute("data-theme", isDark ? "dark" : "light");

  el.style.setProperty("--bg",         c.background);
  el.style.setProperty("--bg-card",    c.card);
  el.style.setProperty("--text",       c.text);
  el.style.setProperty("--text-muted", c.textSecondary);
  el.style.setProperty("--accent",     acc);
  el.style.setProperty("--border",     c.border);

  // Body background + color synced too
  document.body.style.background = c.background;
  document.body.style.color      = c.text;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to light for anyone who hasn't picked a theme yet — overridden
  // below by whatever the user actually saved, if anything.
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  // Load saved preference and apply immediately on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("@theme_mode");
    const dark  = saved ? saved === "dark" : false;
    setIsDarkMode(dark);
    applyThemeVars(dark);
  }, []);

  // Re-apply CSS vars whenever isDarkMode changes
  React.useEffect(() => {
    applyThemeVars(isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem("@theme_mode", next ? "dark" : "light");
    // applyThemeVars is called by the useEffect above
  };

  return (
    <ThemeContext.Provider value={{
      isDarkMode,
      toggleTheme,
      colors: isDarkMode ? darkColors : lightColors,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}