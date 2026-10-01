"use client";

import { useState } from "react";

// Bestätigungsdialog zum Löschen eines Kunden: Der Name muss exakt eingetippt
// werden, erst dann wird "Endgültig löschen" aktiv. (window.prompt ist in
// Next.js/Turbopack-Dev und vielen Browser-Kontexten nicht verfügbar.)
export default function DeleteTenantModal({
  tenantName,
  onCancel,
  onConfirm,
}: {
  tenantName: string;
  onCancel: () => void;
  onConfirm: (typedName: string) => Promise<string | null>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed === tenantName;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError(null);
    const message = await onConfirm(typed);
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="delete-tenant-title">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onCancel} />
      <form onSubmit={confirm} className="relative w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 id="delete-tenant-title" className="text-base font-semibold text-foreground">
          Kunden löschen
        </h2>
        <p className="mt-2 text-sm text-foreground">
          Möchtest du den Kunden <span className="font-semibold">„{tenantName}“</span> wirklich löschen?
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Das kann nicht rückgängig gemacht werden. Gelöscht werden nur Kunden ohne Benutzer und ohne Daten.
        </p>

        <label htmlFor="delete-tenant-confirm" className="mb-1 mt-4 block text-xs font-medium text-muted-foreground">
          Zur Bestätigung den Kundennamen exakt eingeben
        </label>
        <input
          id="delete-tenant-confirm"
          autoComplete="off"
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={tenantName}
          className="ring-focus h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground/60"
        />

        {error && <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="ring-focus min-h-[44px] rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={!matches || busy}
            className="ring-focus min-h-[44px] rounded-lg bg-danger px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Wird gelöscht…" : "Endgültig löschen"}
          </button>
        </div>
      </form>
    </div>
  );
}
