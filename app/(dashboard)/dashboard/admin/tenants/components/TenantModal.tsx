"use client";

import { useState, useTransition } from "react";
import { PLAN_FEATURES, PLAN_KEYS, PLAN_LABELS, TENANT_FEATURE_KEYS, TENANT_FEATURE_LABELS, type PlanKey, type TenantFeatureKey } from "@/lib/plans";
import type { TenantInput, TenantUserInput } from "../types";
import TenantUserFields, { EMPTY_USER } from "./TenantUserFields";
import TenantUsersPanel from "./TenantUsersPanel";
import EmailSettingsForm from "@/components/settings/EmailSettingsForm";

// Kunde anlegen / bearbeiten. Paketwechsel setzt die Schalter auf den
// Paket-Standard; abweichende Schalter werden als Override gespeichert.
// Beim Anlegen wird direkt der Erst-Administrator mit angelegt; beim Bearbeiten
// werden die Benutzer des Kunden angezeigt und können ergänzt werden.
export default function TenantModal({
  title,
  initial,
  tenantId,
  tenantOptions = [],
  onClose,
  onSubmit,
  onUserAdded,
  onUserMoved,
  onUserRemoved,
}: {
  title: string;
  initial: TenantInput;
  // gesetzt = Bearbeiten eines bestehenden Kunden
  tenantId?: string;
  tenantOptions?: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (input: TenantInput, firstAdmin: TenantUserInput) => Promise<string | null>;
  onUserAdded?: () => void;
  onUserMoved?: (targetTenantId: string) => void;
  onUserRemoved?: () => void;
}) {
  const [form, setForm] = useState<TenantInput>(initial);
  const [firstAdmin, setFirstAdmin] = useState<TenantUserInput>({ ...EMPTY_USER });
  const [tab, setTab] = useState<"general" | "users" | "email">("general");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setPlan(plan: PlanKey) {
    setForm((prev) => ({ ...prev, plan, features: { ...PLAN_FEATURES[plan] } }));
  }

  function toggleFeature(key: TenantFeatureKey) {
    setForm((prev) => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const message = await onSubmit(form, firstAdmin);
      if (message) setError(message);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="ring-focus -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {tenantId && (
          <div role="tablist" className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1">
            {(
              [
                ["general", "Paket & Features"],
                ["users", "Benutzer"],
                ["email", "E-Mail"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`ring-focus min-h-[36px] rounded-lg px-2 text-xs font-medium transition-colors sm:text-sm ${
                  tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tenantId && tab === "users" && (
          <div className="mt-4">
            <TenantUsersPanel
              tenantId={tenantId}
              tenantOptions={tenantOptions}
              onUserAdded={() => onUserAdded?.()}
              onUserMoved={(target) => onUserMoved?.(target)}
              onUserRemoved={() => onUserRemoved?.()}
            />
          </div>
        )}
        {tenantId && tab === "email" && (
          <div className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Absender für Benachrichtigungen dieses Kunden. Ohne Einrichtung ist sein E-Mail-Versand gesperrt.
            </p>
            <EmailSettingsForm tenantId={tenantId} bare />
          </div>
        )}

        <div className={`mt-4 flex flex-col gap-4 ${tenantId && tab !== "general" ? "hidden" : ""}`}>
          <div>
            <label htmlFor="tenant-name" className="mb-1 block text-xs font-medium text-muted-foreground">
              Name der Organisation / Kunde
            </label>
            <input
              id="tenant-name"
              name="name"
              required
              autoComplete="organization"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z. B. Hüseyin Tas GmbH"
              className="ring-focus h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Paket</legend>
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {PLAN_KEYS.map((plan) => {
                const active = form.plan === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPlan(plan)}
                    className={`ring-focus min-h-[44px] rounded-xl border px-3 text-sm font-medium transition-colors ${
                      active ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {PLAN_LABELS[plan]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Features</legend>
            <ul className="flex flex-col gap-2">
              {TENANT_FEATURE_KEYS.map((key) => {
                const enabled = form.features[key];
                const isOverride = enabled !== PLAN_FEATURES[form.plan][key];
                return (
                  <li key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{TENANT_FEATURE_LABELS[key]}</p>
                      <p className="text-xs text-muted-foreground">
                        {isOverride ? "Abweichend vom Paket" : `Paket-Standard (${PLAN_FEATURES[form.plan][key] ? "enthalten" : "nicht enthalten"})`}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={TENANT_FEATURE_LABELS[key]}
                      onClick={() => toggleFeature(key)}
                      className={`ring-focus relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
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
          </fieldset>

          {tenantId ? null : (
            <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
              <legend className="sr-only">Erstbenutzer / Administrator</legend>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Erstbenutzer / Administrator</h3>
                <p className="text-xs text-muted-foreground">Wird als Admin dieses Kunden angelegt und kann weitere Benutzer verwalten.</p>
              </div>
              <TenantUserFields idPrefix="tenant-first-admin" value={firstAdmin} onChange={setFirstAdmin} />
            </fieldset>
          )}
        </div>

        {error && <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className={`mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${tenantId && tab !== "general" ? "hidden" : ""}`}>
          <button
            type="button"
            onClick={onClose}
            className="ring-focus min-h-[44px] rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="ring-focus min-h-[44px] rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
          >
            {isPending ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
