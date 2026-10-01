"use client";

import type { ReactElement } from "react";
import { useTheme, type ThemePreference } from "./ThemeProvider";

function IconSun(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconMoon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" strokeLinejoin="round" />
    </svg>
  );
}

function IconMonitor(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" strokeLinejoin="round" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </svg>
  );
}

// Segment-Schalter Hell / Dunkel / System. Bei "System" wird angezeigt, welches
// Theme das Betriebssystem gerade liefert.
export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const systemResolved = resolvedTheme === "dark" ? "Dunkel" : "Hell";

  const options: { value: ThemePreference; label: string; hint?: string; title: string; icon: ReactElement }[] = [
    { value: "light", label: "Hell", title: "Helles Design", icon: <IconSun /> },
    { value: "dark", label: "Dunkel", title: "Dunkles Design", icon: <IconMoon /> },
    {
      value: "system",
      label: "System",
      hint: theme === "system" ? systemResolved : undefined,
      title: `Wie das Betriebssystem${theme === "system" ? ` (aktuell ${systemResolved})` : ""}`,
      icon: <IconMonitor />,
    },
  ];

  return (
    <div role="radiogroup" aria-label="Darstellung" className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => setTheme(option.value)}
            className={`ring-focus flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-xs transition-colors ${
              active
                ? "bg-white font-medium text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.icon}
            <span className="leading-tight">{option.label}</span>
            {option.hint && <span className="text-[10px] leading-none opacity-80">({option.hint})</span>}
          </button>
        );
      })}
    </div>
  );
}
