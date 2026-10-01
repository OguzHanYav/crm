"use client";

import { useMemo, useState } from "react";
import { PLAN_FEATURES, PLAN_KEYS, PLAN_LABELS, TENANT_FEATURE_KEYS, type PlanKey, type TenantFeatureKey } from "@/lib/plans";
import { createTenant, deleteTenant, syncExistingTenantsAsContacts, updateTenant } from "../actions";
import type { TenantInput, TenantRow, TenantUserInput } from "../types";
import TenantModal from "./TenantModal";
import DeleteTenantModal from "./DeleteTenantModal";
import { useTenant } from "@/components/tenant/TenantProvider";

const PLAN_STYLE: Record<PlanKey, string> = {
  standard: "bg-muted text-foreground/80",
  plus: "bg-info-soft text-info",
  super: "bg-accent-soft text-accent",
};

const FEATURE_SHORT: Record<TenantFeatureKey, string> = {
  calls: "Anrufe",
  notifications: "Benachrichtigungen",
  whatsapp: "WhatsApp",
};

function formatDateDE(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export default function TenantTable({
  initialTenants,
  homeTenantId,
}: {
  initialTenants: TenantRow[];
  // Heimat-Mandant des Super-Admins (profiles.tenant_id)
  homeTenantId: string | null;
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanKey | "">("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; tenant: TenantRow } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { tenant: activeTenant, switchTenant } = useTenant();

  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Bestehende Kunden als Kontakte ins eigene CRM übernehmen (ohne Dubletten).
  async function handleSync() {
    setError(null);
    setSyncNotice(null);
    setSyncing(true);
    const result = await syncExistingTenantsAsContacts();
    setSyncing(false);
    if (!result.success || !result.data) {
      setError(result.message ?? "Abgleich fehlgeschlagen.");
      return;
    }
    const { created, existing, failed } = result.data;
    setSyncNotice(
      `${created} Kunde(n) als Kontakt angelegt, ${existing} bereits vorhanden${failed ? `, ${failed} fehlgeschlagen` : ""}.`
    );
  }

  async function handleOpen(tenant: TenantRow) {
    setError(null);
    setBusyId(tenant.id);
    const message = await switchTenant(tenant.id);
    if (message) {
      setError(message);
      setBusyId(null);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => (!q || t.name.toLowerCase().includes(q)) && (!planFilter || t.plan === planFilter));
  }, [tenants, query, planFilter]);

  async function handleCreate(input: TenantInput, firstAdmin: TenantUserInput) {
    const result = await createTenant(input, firstAdmin);
    if (!result.success || !result.data) return result.message ?? "Anlegen fehlgeschlagen.";
    setTenants((prev) => [...prev, result.data as TenantRow]);
    return null;
  }

  async function handleUpdate(id: string, input: TenantInput) {
    const result = await updateTenant(id, input);
    if (!result.success || !result.data) return result.message ?? "Speichern fehlgeschlagen.";
    setTenants((prev) => prev.map((t) => (t.id === id ? (result.data as TenantRow) : t)));
    return null;
  }

  // Doppelte Sicherheitsabfrage: Dialog mit Namenseingabe (prüft auch der Server).
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null);

  function handleDelete(tenant: TenantRow) {
    setError(null);
    setDeleteTarget(tenant);
  }

  async function confirmDelete(typedName: string): Promise<string | null> {
    if (!deleteTarget) return null;
    const tenant = deleteTarget;
    setBusyId(tenant.id);
    const result = await deleteTenant(tenant.id, typedName);
    setBusyId(null);
    if (!result.success) return result.message ?? "Löschen fehlgeschlagen.";
    setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
    setDeleteTarget(null);
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kunden &amp; Mandanten</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenants.length} {tenants.length === 1 ? "Kunde" : "Kunden"} · Pakete und Features verwalten
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            title="Legt für jeden Kunden ohne Eintrag einen Kontakt im eigenen CRM an"
            className="ring-focus min-h-[44px] rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-60 max-sm:w-full"
          >
            {syncing ? "Gleicht ab…" : "Kunden ins eigene CRM übernehmen"}
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="ring-focus min-h-[44px] rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:brightness-110 max-sm:w-full"
          >
            + Neuen Kunden anlegen
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          aria-label="Kunden suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nach Kundenname suchen…"
          className="ring-focus h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <select
          aria-label="Nach Paket filtern"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as PlanKey | "")}
          className="ring-focus h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground sm:w-48"
        >
          <option value="">Alle Pakete</option>
          {PLAN_KEYS.map((plan) => (
            <option key={plan} value={plan}>
              {PLAN_LABELS[plan]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {syncNotice && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{syncNotice}</p>}

      <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-[21%] px-3 py-2.5 font-medium">Kunden-Name</th>
              <th className="w-[11%] px-3 py-2.5 font-medium">Paket</th>
              <th className="w-[10%] px-3 py-2.5 font-medium">Benutzer</th>
              <th className="w-[22%] px-3 py-2.5 font-medium">Aktive Features</th>
              <th className="w-[12%] px-3 py-2.5 font-medium">Erstellt am</th>
              <th className="w-[24%] px-3 py-2.5 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Keine Kunden gefunden.
                </td>
              </tr>
            ) : (
              visible.map((tenant) => {
                const active = TENANT_FEATURE_KEYS.filter((key) => tenant.features[key]);
                return (
                  <tr key={tenant.id} className={busyId === tenant.id ? "opacity-60" : undefined}>
                    <td className="px-3 py-2.5">
                      <p className="truncate font-medium text-foreground">{tenant.name}</p>
                      {tenant.isDefault && <p className="text-xs text-muted-foreground">Standard-Mandant</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_STYLE[tenant.plan]}`}>
                        {PLAN_LABELS[tenant.plan]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{tenant.userCount}</td>
                    <td className="px-3 py-2.5">
                      {active.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Keine</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {active.map((key) => (
                            <span
                              key={key}
                              title={tenant.features[key] !== PLAN_FEATURES[tenant.plan][key] ? "Abweichend vom Paket" : undefined}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                key in tenant.overrides ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                              }`}
                            >
                              {FEATURE_SHORT[key]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDateDE(tenant.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpen(tenant)}
                          disabled={busyId === tenant.id || activeTenant.id === tenant.id}
                          title={
                            tenant.id === homeTenantId
                              ? "Dein eigener Mandant"
                              : activeTenant.id === tenant.id
                                ? "Dieser Mandant ist bereits geöffnet"
                                : "Umgebung dieses Kunden öffnen"
                          }
                          className="ring-focus rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:brightness-110 disabled:opacity-50"
                        >
                          {tenant.id === homeTenantId ? "Eigener" : activeTenant.id === tenant.id ? "Geöffnet" : "Öffnen"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ mode: "edit", tenant })}
                          className="ring-focus rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tenant)}
                          disabled={tenant.isDefault || busyId === tenant.id}
                          title={tenant.isDefault ? "Der Standard-Mandant kann nicht gelöscht werden" : undefined}
                          className="ring-focus rounded-md border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-40"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Gelb markierte Features weichen vom Paket ab. Benutzer werden einem Kunden über{" "}
        <code>profiles.tenant_id</code> zugeordnet.
      </p>

      {deleteTarget && (
        <DeleteTenantModal
          tenantName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {modal?.mode === "create" && (
        <TenantModal
          title="Neuen Kunden anlegen"
          initial={{ name: "", plan: "standard", features: { ...PLAN_FEATURES.standard } }}
          onClose={() => setModal(null)}
          onSubmit={handleCreate}
        />
      )}
      {modal?.mode === "edit" && (
        <TenantModal
          title={`Kunde bearbeiten: ${modal.tenant.name}`}
          initial={{ name: modal.tenant.name, plan: modal.tenant.plan, features: { ...modal.tenant.features } }}
          tenantId={modal.tenant.id}
          tenantOptions={tenants.map((t) => ({ id: t.id, name: t.name }))}
          onUserAdded={() =>
            setTenants((prev) => prev.map((t) => (t.id === modal.tenant.id ? { ...t, userCount: t.userCount + 1 } : t)))
          }
          onUserMoved={(targetId) =>
            setTenants((prev) =>
              prev.map((t) =>
                t.id === modal.tenant.id
                  ? { ...t, userCount: Math.max(0, t.userCount - 1) }
                  : t.id === targetId
                    ? { ...t, userCount: t.userCount + 1 }
                    : t
              )
            )
          }
          onUserRemoved={() =>
            setTenants((prev) =>
              prev.map((t) => (t.id === modal.tenant.id ? { ...t, userCount: Math.max(0, t.userCount - 1) } : t))
            )
          }
          onClose={() => setModal(null)}
          onSubmit={(input) => handleUpdate(modal.tenant.id, input)}
        />
      )}
    </>
  );
}
