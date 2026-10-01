"use client";

import { useEffect, useState, useTransition } from "react";
import { addTenantUser, listTenantUsers, moveTenantUser, removeTenantUser, sendUserPasswordReset, setUserTemporaryPassword } from "../actions";
import type { TenantUser, TenantUserInput } from "../types";
import TenantUserFields, { EMPTY_USER, generatePassword } from "./TenantUserFields";

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", super_admin: "Super-Admin", employee: "Mitarbeiter" };

// Benutzer eines bestehenden Kunden anzeigen und weitere hinzufügen.
export default function TenantUsersPanel({
  tenantId,
  tenantOptions,
  onUserAdded,
  onUserMoved,
  onUserRemoved,
}: {
  tenantId: string;
  // alle Kunden (für "Verschieben nach …")
  tenantOptions: { id: string; name: string }[];
  onUserAdded: () => void;
  onUserMoved: (targetTenantId: string) => void;
  onUserRemoved: () => void;
}) {
  const [users, setUsers] = useState<TenantUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TenantUserInput>({ ...EMPTY_USER, role: "employee" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listTenantUsers(tenantId).then((result) => {
      if (cancelled) return;
      if (result.success) setUsers(result.data ?? []);
      else setLoadError(result.message ?? "Benutzer konnten nicht geladen werden.");
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const [busyUser, setBusyUser] = useState<string | null>(null);

  async function resetLink(user: TenantUser) {
    setError(null);
    setNotice(null);
    setBusyUser(user.id);
    const result = await sendUserPasswordReset(user.id);
    setBusyUser(null);
    if (result.success) setNotice(result.message ?? "Reset-Link gesendet.");
    else setError(result.message ?? "Reset-Link konnte nicht gesendet werden.");
  }

  async function move(user: TenantUser, targetTenantId: string) {
    const target = tenantOptions.find((t) => t.id === targetTenantId);
    if (!target) return;
    if (!window.confirm(`${user.email ?? "Benutzer"} zum Kunden „${target.name}“ verschieben? Er sieht danach nur noch dessen Daten.`)) return;
    setError(null);
    setNotice(null);
    setBusyUser(user.id);
    const result = await moveTenantUser(user.id, targetTenantId);
    setBusyUser(null);
    if (!result.success) {
      setError(result.message ?? "Verschieben fehlgeschlagen.");
      return;
    }
    setUsers((prev) => (prev ?? []).filter((u) => u.id !== user.id));
    setNotice(`${user.email} gehört jetzt zu „${target.name}“.`);
    onUserMoved(targetTenantId);
  }

  async function remove(user: TenantUser) {
    if (!window.confirm(`Benutzer ${user.email ?? ""} endgültig entfernen? Login und Profil werden gelöscht; die CRM-Daten des Kunden bleiben erhalten.`)) return;
    setError(null);
    setNotice(null);
    setBusyUser(user.id);
    const result = await removeTenantUser(user.id);
    setBusyUser(null);
    if (!result.success) {
      setError(result.message ?? "Entfernen fehlgeschlagen.");
      return;
    }
    setUsers((prev) => (prev ?? []).filter((u) => u.id !== user.id));
    setNotice(`${user.email} wurde entfernt.`);
    onUserRemoved();
  }

  async function tempPassword(user: TenantUser) {
    const suggestion = generatePassword();
    const password = window.prompt(
      `Neues temporäres Passwort für ${user.email ?? "diesen Benutzer"} (mind. 8 Zeichen):`,
      suggestion
    );
    if (password === null) return;
    setError(null);
    setNotice(null);
    setBusyUser(user.id);
    const result = await setUserTemporaryPassword(user.id, password);
    setBusyUser(null);
    if (result.success) setNotice(`Neues Passwort für ${user.email} gesetzt: ${password} — bitte sicher übermitteln.`);
    else setError(result.message ?? "Passwort konnte nicht gesetzt werden.");
  }

  function add() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await addTenantUser(tenantId, form);
      if (!result.success || !result.data) {
        setError(result.message ?? "Benutzer konnte nicht angelegt werden.");
        return;
      }
      setUsers((prev) => [...(prev ?? []), result.data as TenantUser]);
      setNotice(form.sendInvite ? `Einladung an ${result.data.email} gesendet.` : `Benutzer ${result.data.email} angelegt.`);
      setForm({ ...EMPTY_USER, role: "employee" });
      setShowForm(false);
      onUserAdded();
    });
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Benutzer dieses Kunden</h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="ring-focus rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
          >
            + Benutzer hinzufügen
          </button>
        )}
      </div>

      {loadError ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</p>
      ) : users === null ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Benutzer zugeordnet.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border">
          {users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2 ${busyUser === u.id ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{ROLE_LABEL[u.role] ?? u.role}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {u.role === "super_admin" ? (
                  <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent" title="Super-Admins bleiben immer im Inhaber-Mandanten">
                    Inhaber — fest zugeordnet
                  </span>
                ) : (
                  <>
                    <select
                      aria-label={`${u.email ?? "Benutzer"} verschieben`}
                      value=""
                      onChange={(e) => e.target.value && move(u, e.target.value)}
                      disabled={busyUser === u.id}
                      className="ring-focus h-7 max-w-[150px] rounded-md border border-border bg-card px-1.5 text-xs text-muted-foreground"
                    >
                      <option value="">Verschieben nach…</option>
                      {tenantOptions
                        .filter((t) => t.id !== tenantId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      disabled={busyUser === u.id}
                      className="ring-focus rounded-md border border-danger/30 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      Entfernen
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => resetLink(u)}
                  disabled={busyUser === u.id || !u.email}
                  className="ring-focus rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  Reset-Link
                </button>
                <button
                  type="button"
                  onClick={() => tempPassword(u)}
                  disabled={busyUser === u.id}
                  className="ring-focus rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  Neues Passwort
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {notice && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{notice}</p>}

      {showForm && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <TenantUserFields idPrefix="tenant-add-user" value={form} onChange={setForm} showRole />
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="ring-focus min-h-[40px] rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={add}
              disabled={isPending}
              className="ring-focus min-h-[40px] rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
            >
              {isPending ? "Legt an…" : "Benutzer anlegen"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
