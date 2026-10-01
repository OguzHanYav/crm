"use client";

import type { TenantUserInput } from "../types";

const inputClass =
  "ring-focus h-10 w-full min-w-0 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground";

// Sicheres Zufallspasswort (ohne leicht verwechselbare Zeichen).
export function generatePassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!$%&*?";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export const EMPTY_USER: TenantUserInput = { name: "", email: "", password: "", sendInvite: false, role: "admin" };

// Eingabefelder für einen Benutzer eines Kunden (Erst-Admin bzw. weitere Benutzer).
export default function TenantUserFields({
  idPrefix,
  value,
  onChange,
  showRole = false,
}: {
  idPrefix: string;
  value: TenantUserInput;
  onChange: (next: TenantUserInput) => void;
  showRole?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-name`} className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
          <input
            id={`${idPrefix}-name`}
            autoComplete="off"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="z. B. Hüseyin Tas"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-email`} className="mb-1 block text-xs font-medium text-muted-foreground">E-Mail</label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="off"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="hueseyin@beispiel.de"
            className={inputClass}
          />
        </div>
      </div>

      {showRole && (
        <div>
          <label htmlFor={`${idPrefix}-role`} className="mb-1 block text-xs font-medium text-muted-foreground">Rolle</label>
          <select
            id={`${idPrefix}-role`}
            value={value.role}
            onChange={(e) => onChange({ ...value, role: e.target.value as TenantUserInput["role"] })}
            className={inputClass}
          >
            <option value="admin">Administrator</option>
            <option value="employee">Mitarbeiter</option>
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={value.sendInvite}
          onChange={(e) => onChange({ ...value, sendInvite: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        Einladungs-E-Mail senden (statt temporärem Passwort)
      </label>

      {!value.sendInvite && (
        <div>
          <label htmlFor={`${idPrefix}-password`} className="mb-1 block text-xs font-medium text-muted-foreground">
            Temporäres Passwort
          </label>
          <div className="flex gap-2">
            <input
              id={`${idPrefix}-password`}
              type="text"
              autoComplete="new-password"
              value={value.password}
              onChange={(e) => onChange({ ...value, password: e.target.value })}
              placeholder="mind. 8 Zeichen"
              className={`${inputClass} font-mono`}
            />
            <button
              type="button"
              onClick={() => onChange({ ...value, password: generatePassword() })}
              className="ring-focus shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted/50"
            >
              Generieren
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Bitte notieren und dem Benutzer sicher mitteilen.</p>
        </div>
      )}
    </div>
  );
}
