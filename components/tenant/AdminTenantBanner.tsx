"use client";

import { useState } from "react";
import { useTenant } from "./TenantProvider";

// Hinweisleiste oben im Dashboard, solange ein Super-Admin einen Kunden geöffnet hat.
export default function AdminTenantBanner() {
  const { tenant, isImpersonating, exitTenant } = useTenant();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isImpersonating) return null;

  async function handleExit() {
    setBusy(true);
    setError(null);
    const message = await exitTenant();
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-warning/40 bg-warning-soft px-4 py-2 text-sm text-foreground sm:px-6"
    >
      <p className="min-w-0">
        <span className="font-semibold">Impersonations-Modus:</span> Du siehst aktuell den Mandanten{" "}
        <span className="font-semibold">{tenant.name}</span>.
        {error && <span className="ml-2 text-danger">{error}</span>}
      </p>
      <button
        type="button"
        onClick={handleExit}
        disabled={busy}
        className="ring-focus min-h-[36px] shrink-0 rounded-lg bg-foreground px-3 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Wechselt…" : "Zurück zur Kundenverwaltung"}
      </button>
    </div>
  );
}
