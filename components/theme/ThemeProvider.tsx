"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

// Läuft als Inline-Script im <head> (app/layout.tsx), BEVOR die Seite gemalt wird —
// verhindert ein kurzes Aufblitzen des hellen Themes im Dark Mode.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  // Gewählte Einstellung (Standard: "system", solange nichts gespeichert ist).
  theme: ThemePreference;
  // Tatsächlich angezeigtes Theme — bei "system" das des Betriebssystems.
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  return (
    useContext(ThemeContext) ?? {
      theme: "system" as ThemePreference,
      resolvedTheme: "light" as ResolvedTheme,
      setTheme: () => {},
    }
  );
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: ThemePreference): ResolvedTheme {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Standard ist strikt "system": ohne gespeicherte Wahl folgt die App dem Betriebssystem.
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") setThemeState(stored);
    } catch {
      // localStorage nicht verfügbar — System-Einstellung bleibt aktiv.
    }
  }, []);

  // Bei "System" auf Wechsel der Betriebssystem-Einstellung reagieren.
  useEffect(() => {
    setResolvedTheme(applyTheme(theme));
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // nur für diese Sitzung
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}
