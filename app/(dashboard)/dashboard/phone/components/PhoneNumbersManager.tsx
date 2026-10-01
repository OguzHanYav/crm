"use client";

import { useState, useTransition } from "react";
import { assignPhoneNumber, createPhoneNumber, deletePhoneNumber, updatePhoneNumber } from "../actions";
import { PHONE_STATUS_LABELS, type MemberOption, type PhoneNumber, type PhoneNumberInput, type PhoneStatus } from "../types";

const STATUS_STYLE: Record<PhoneStatus, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-muted text-muted-foreground",
  connecting: "bg-warning/15 text-warning",
};

const EMPTY_FORM: PhoneNumberInput = { number: "", label: "", assignedUserId: null, status: "active" };

const inputClass =
  "ring-focus h-10 w-full min-w-0 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground";

function PhoneFormModal({
  title,
  initial,
  members,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: PhoneNumberInput;
  members: MemberOption[];
  onClose: () => void;
  onSubmit: (input: PhoneNumberInput) => Promise<string | null>;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const message = await onSubmit(form);
      if (message) setError(message);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl sm:p-5"
      >
        <h2 className="text-base font-semibold text-foreground">{title}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="phone-number" className="mb-1 block text-xs font-medium text-muted-foreground">Rufnummer</label>
            <input
              id="phone-number"
              name="number"
              autoComplete="off"
              inputMode="tel"
              required
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              placeholder="+49 30 1234567"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="phone-label" className="mb-1 block text-xs font-medium text-muted-foreground">Bezeichnung</label>
            <input
              id="phone-label"
              name="label"
              autoComplete="off"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="z. B. Support-Hotline"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="phone-assignee" className="mb-1 block text-xs font-medium text-muted-foreground">Mitarbeiter</label>
            <select
              id="phone-assignee"
              name="assignedUserId"
              value={form.assignedUserId ?? ""}
              onChange={(e) => setForm({ ...form, assignedUserId: e.target.value || null })}
              className={inputClass}
            >
              <option value="">— Nicht zugewiesen —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="phone-status" className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <select
              id="phone-status"
              name="status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PhoneStatus })}
              className={inputClass}
            >
              {(Object.keys(PHONE_STATUS_LABELS) as PhoneStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PHONE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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

export default function PhoneNumbersManager({
  initialNumbers,
  members,
}: {
  initialNumbers: PhoneNumber[];
  members: MemberOption[];
}) {
  const [numbers, setNumbers] = useState(initialNumbers);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; phone: PhoneNumber } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function replace(phone: PhoneNumber) {
    setNumbers((prev) => prev.map((p) => (p.id === phone.id ? phone : p)));
  }

  async function handleCreate(input: PhoneNumberInput) {
    const result = await createPhoneNumber(input);
    if (!result.success || !result.data) return result.message ?? "Anlegen fehlgeschlagen.";
    setNumbers((prev) => [...prev, result.data as PhoneNumber]);
    return null;
  }

  async function handleUpdate(id: string, input: PhoneNumberInput) {
    const result = await updatePhoneNumber(id, input);
    if (!result.success || !result.data) return result.message ?? "Speichern fehlgeschlagen.";
    replace(result.data);
    return null;
  }

  async function handleAssign(phone: PhoneNumber, userId: string) {
    setError(null);
    setBusyId(phone.id);
    const result = await assignPhoneNumber(phone.id, userId || null);
    setBusyId(null);
    if (!result.success || !result.data) setError(result.message ?? "Zuweisung fehlgeschlagen.");
    else replace(result.data);
  }

  async function handleDelete(phone: PhoneNumber) {
    if (!window.confirm(`Rufnummer ${phone.number} wirklich löschen?`)) return;
    setError(null);
    setBusyId(phone.id);
    const result = await deletePhoneNumber(phone.id);
    setBusyId(null);
    if (!result.success) setError(result.message ?? "Löschen fehlgeschlagen.");
    else setNumbers((prev) => prev.filter((p) => p.id !== phone.id));
  }

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Rufnummern &amp; Telefone</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{numbers.length} angelegt</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="ring-focus min-h-[44px] rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:brightness-110 max-sm:w-full"
        >
          + Neues Telefon / Nummer
        </button>
      </div>

      {error && <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {numbers.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Noch keine Rufnummern angelegt.
        </p>
      ) : (
        <div className="mt-4 w-full max-w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[680px] table-fixed text-sm">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-[20%] px-3 py-2 font-medium">Rufnummer</th>
                <th className="w-[22%] px-3 py-2 font-medium">Bezeichnung</th>
                <th className="w-[26%] px-3 py-2 font-medium">Mitarbeiter</th>
                <th className="w-[12%] px-3 py-2 font-medium">Status</th>
                <th className="w-[20%] px-3 py-2 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {numbers.map((phone) => (
                <tr key={phone.id} className={busyId === phone.id ? "opacity-60" : undefined}>
                  <td className="truncate px-3 py-2 font-medium text-foreground tabular-nums">{phone.number}</td>
                  <td className="truncate px-3 py-2 text-foreground/90">{phone.label || "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Mitarbeiter für ${phone.number}`}
                      value={phone.assigned_user_id ?? ""}
                      onChange={(e) => handleAssign(phone, e.target.value)}
                      disabled={busyId === phone.id}
                      className="ring-focus h-9 w-full min-w-0 rounded-lg border border-border bg-input px-2 text-sm text-foreground"
                    >
                      <option value="">— Nicht zugewiesen —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[phone.status]}`}>
                      {PHONE_STATUS_LABELS[phone.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", phone })}
                        className="ring-focus rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(phone)}
                        disabled={busyId === phone.id}
                        className="ring-focus rounded-md border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === "create" && (
        <PhoneFormModal
          title="Neues Telefon / Nummer hinzufügen"
          initial={EMPTY_FORM}
          members={members}
          onClose={() => setModal(null)}
          onSubmit={handleCreate}
        />
      )}
      {modal?.mode === "edit" && (
        <PhoneFormModal
          title="Telefon / Nummer bearbeiten"
          initial={{
            number: modal.phone.number,
            label: modal.phone.label ?? "",
            assignedUserId: modal.phone.assigned_user_id,
            status: modal.phone.status,
          }}
          members={members}
          onClose={() => setModal(null)}
          onSubmit={(input) => handleUpdate(modal.phone.id, input)}
        />
      )}
    </section>
  );
}
