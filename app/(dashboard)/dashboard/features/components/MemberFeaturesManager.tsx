"use client";

import { useState } from "react";
import { resetUserFeatureFlag, setUserFeatureFlag } from "../actions";
import type { FeatureFlags, FeatureKey } from "@/lib/features";

export type MemberFeatureRow = {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  overrides: Partial<Record<FeatureKey, boolean>>;
};

type FeatureInfo = { key: FeatureKey; label: string; description: string };

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`ring-focus relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-card shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function MemberFeaturesManager({
  features,
  globalFlags,
  initialRows,
}: {
  features: FeatureInfo[];
  globalFlags: FeatureFlags;
  initialRows: MemberFeatureRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setOverride(userId: string, key: FeatureKey, value: boolean | undefined) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== userId) return r;
        const overrides = { ...r.overrides };
        if (value === undefined) delete overrides[key];
        else overrides[key] = value;
        return { ...r, overrides };
      })
    );
  }

  async function toggle(row: MemberFeatureRow, key: FeatureKey) {
    const previous = row.overrides[key];
    const effective = previous ?? globalFlags[key];
    const next = !effective;
    setError(null);
    setBusy(`${row.id}:${key}`);
    setOverride(row.id, key, next);
    const result = await setUserFeatureFlag(row.id, key, next);
    setBusy(null);
    if (!result.success) {
      setOverride(row.id, key, previous);
      setError(result.message ?? "Speichern fehlgeschlagen.");
    }
  }

  async function reset(row: MemberFeatureRow, key: FeatureKey) {
    const previous = row.overrides[key];
    setError(null);
    setBusy(`${row.id}:${key}`);
    setOverride(row.id, key, undefined);
    const result = await resetUserFeatureFlag(row.id, key);
    setBusy(null);
    if (!result.success) {
      setOverride(row.id, key, previous);
      setError(result.message ?? "Zurücksetzen fehlgeschlagen.");
    }
  }

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5">
      <h2 className="text-base font-semibold text-foreground">Freigaben pro Mitglied</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Ohne eigene Einstellung gilt der Standard (unten). Änderungen wirken sofort.
      </p>

      {error && <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="min-w-0 rounded-lg border border-border px-3 py-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                {row.email && <p className="truncate text-xs text-muted-foreground">{row.email}</p>}
              </div>
              {row.isAdmin && (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                  Admin – alle Features
                </span>
              )}
            </div>

            {!row.isAdmin && (
              <div className="mt-3 flex flex-col gap-2">
                {features.map((feature) => {
                  const own = row.overrides[feature.key];
                  const effective = own ?? globalFlags[feature.key];
                  const isBusy = busy === `${row.id}:${feature.key}`;
                  return (
                    <div key={feature.key} className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{feature.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {own === undefined ? (
                            <>Standard ({globalFlags[feature.key] ? "freigeschaltet" : "gesperrt"})</>
                          ) : (
                            <>
                              Individuell {own ? "freigeschaltet" : "gesperrt"} ·{" "}
                              <button
                                type="button"
                                onClick={() => reset(row, feature.key)}
                                disabled={isBusy}
                                className="ring-focus rounded text-accent underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                auf Standard zurücksetzen
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      <Toggle
                        checked={effective}
                        disabled={isBusy}
                        label={`${feature.label} für ${row.name}`}
                        onChange={() => toggle(row, feature.key)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
