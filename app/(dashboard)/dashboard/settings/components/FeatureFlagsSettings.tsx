"use client";

import { useState, useTransition } from "react";
import { setFeatureFlag } from "../feature-actions";
import type { FeatureFlags, FeatureKey } from "@/lib/features";

type FeatureInfo = { key: FeatureKey; label: string; description: string };

// Admin-Bereich: Features für Mitglieder freischalten/sperren. Admins selbst
// haben immer Zugriff auf alle Features.
export default function FeatureFlagsSettings({
  features,
  initialFlags,
}: {
  features: FeatureInfo[];
  initialFlags: FeatureFlags;
}) {
  const [flags, setFlags] = useState(initialFlags);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: FeatureKey) {
    const next = !flags[key];
    setFlags((prev) => ({ ...prev, [key]: next }));
    setError(null);
    startTransition(async () => {
      const result = await setFeatureFlag(key, next);
      if (!result.success) {
        setFlags((prev) => ({ ...prev, [key]: !next }));
        setError(result.message ?? "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-soft max-sm:p-3">
      <h2 className="text-base font-semibold text-foreground">Standard-Freigaben für Mitglieder</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Gilt für alle Mitglieder ohne eigene Einstellung. Einzelne Mitglieder lassen sich unter „Features“
        abweichend freischalten oder sperren. Administratoren sehen immer alle Features.
      </p>

      {error && <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <ul className="mt-4 flex flex-col gap-2">
        {features.map((feature) => {
          const enabled = flags[feature.key];
          return (
            <li
              key={feature.key}
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border px-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{feature.label} für Mitglieder aktivieren</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${feature.label} für Mitglieder`}
                onClick={() => toggle(feature.key)}
                disabled={isPending}
                className={`ring-focus relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                  enabled ? "bg-accent" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-card shadow transition-transform ${
                    enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
