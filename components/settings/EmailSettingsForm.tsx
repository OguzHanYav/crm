"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getTenantEmailSettings,
  saveTenantEmailSettings,
  sendTenantTestEmail,
  type EmailSettingsInput,
} from "@/app/(dashboard)/dashboard/settings/email-settings-actions";

const inputClass =
  "ring-focus h-10 w-full min-w-0 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground";

const EMPTY: EmailSettingsInput = {
  fromName: "",
  fromEmail: "",
  replyTo: "",
  mode: "smtp",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  apiKey: "",
};

// E-Mail-Absender eines Mandanten (eigenes SMTP-Postfach oder eigener Resend-Key).
// Genutzt in Einstellungen → Admin und in der Kundenverwaltung (Super-Admin).
export default function EmailSettingsForm({ tenantId, bare = false }: { tenantId: string; bare?: boolean }) {
  const [form, setForm] = useState<EmailSettingsInput>(EMPTY);
  const [secrets, setSecrets] = useState({ smtp: false, api: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getTenantEmailSettings(tenantId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.success || !result.data) {
        setError(result.message ?? "E-Mail-Einstellungen konnten nicht geladen werden.");
        return;
      }
      const d = result.data;
      setForm({
        fromName: d.fromName,
        fromEmail: d.fromEmail,
        replyTo: d.replyTo,
        mode: d.mode,
        smtpHost: d.smtpHost,
        smtpPort: d.smtpPort ?? 587,
        smtpUser: d.smtpUser,
        smtpPassword: "",
        apiKey: "",
      });
      setSecrets({ smtp: d.hasSmtpPassword, api: d.hasApiKey });
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveTenantEmailSettings(tenantId, form);
      if (!result.success) {
        setError(result.message ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSecrets({ smtp: secrets.smtp || Boolean(form.smtpPassword), api: secrets.api || Boolean(form.apiKey) });
      setForm((f) => ({ ...f, smtpPassword: "", apiKey: "" }));
      setNotice("E-Mail-Absender gespeichert.");
    });
  }

  function test() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await sendTenantTestEmail(tenantId, testTo);
      if (result.success) setNotice(`Test-E-Mail an ${testTo.trim()} gesendet.`);
      else setError(result.message ?? "Test fehlgeschlagen.");
    });
  }

  const content = loading ? (
    <p className="text-sm text-muted-foreground">Lädt…</p>
  ) : (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${tenantId}-from-name`} className="mb-1 block text-xs font-medium text-muted-foreground">Absender-Name</label>
          <input id={`${tenantId}-from-name`} value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} placeholder="z. B. Hüseyin Tas GmbH" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${tenantId}-from-email`} className="mb-1 block text-xs font-medium text-muted-foreground">Absender-E-Mail</label>
          <input id={`${tenantId}-from-email`} type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="info@kunde.de" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${tenantId}-reply-to`} className="mb-1 block text-xs font-medium text-muted-foreground">Antwort-Adresse (optional)</label>
          <input id={`${tenantId}-reply-to`} type="email" value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} placeholder="Standard: Absender-E-Mail" className={inputClass} />
        </div>
      </div>

      <div role="radiogroup" aria-label="Versandweg" className="grid grid-cols-2 gap-2">
        {(["smtp", "resend"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={form.mode === mode}
            onClick={() => setForm({ ...form, mode })}
            className={`ring-focus min-h-[40px] rounded-xl border px-3 text-sm font-medium transition-colors ${
              form.mode === mode ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground hover:bg-muted/50"
            }`}
          >
            {mode === "smtp" ? "Eigenes SMTP-Postfach" : "Resend-API-Key"}
          </button>
        ))}
      </div>

      {form.mode === "smtp" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor={`${tenantId}-smtp-host`} className="mb-1 block text-xs font-medium text-muted-foreground">SMTP-Server</label>
            <input id={`${tenantId}-smtp-host`} value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} placeholder="smtp.kunde.de" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${tenantId}-smtp-port`} className="mb-1 block text-xs font-medium text-muted-foreground">Port</label>
            <input id={`${tenantId}-smtp-port`} type="number" inputMode="numeric" value={form.smtpPort ?? ""} onChange={(e) => setForm({ ...form, smtpPort: e.target.value ? Number(e.target.value) : null })} placeholder="587" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${tenantId}-smtp-user`} className="mb-1 block text-xs font-medium text-muted-foreground">Benutzer</label>
            <input id={`${tenantId}-smtp-user`} autoComplete="off" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${tenantId}-smtp-password`} className="mb-1 block text-xs font-medium text-muted-foreground">Passwort</label>
            <input id={`${tenantId}-smtp-password`} type="password" autoComplete="new-password" value={form.smtpPassword} onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })} placeholder={secrets.smtp ? "•••••••• (gespeichert — leer lassen = unverändert)" : ""} className={inputClass} />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor={`${tenantId}-api-key`} className="mb-1 block text-xs font-medium text-muted-foreground">Resend-API-Key des Kunden</label>
          <input id={`${tenantId}-api-key`} type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={secrets.api ? "•••••••• (gespeichert — leer lassen = unverändert)" : "re_…"} className={inputClass} />
          <p className="mt-1 text-xs text-muted-foreground">Die Absender-Domain muss im Resend-Konto des Kunden verifiziert sein.</p>
        </div>
      )}

      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {notice && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{notice}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-2">
          <input type="email" aria-label="Empfänger für Test-E-Mail" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Test an …" className={`${inputClass} sm:max-w-xs`} />
          <button type="button" onClick={test} disabled={isPending || !testTo.trim()} className="ring-focus shrink-0 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50">
            Testen
          </button>
        </div>
        <button type="button" onClick={save} disabled={isPending} className="ring-focus min-h-[40px] rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50">
          {isPending ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </div>
  );

  if (bare) return content;
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-soft max-sm:p-3">
      <h2 className="text-base font-semibold text-foreground">E-Mail-Absender</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Benachrichtigungen dieser Organisation werden mit diesem Absender verschickt. Ohne Einrichtung ist der E-Mail-Versand gesperrt.
      </p>
      {content}
    </section>
  );
}
