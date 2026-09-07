"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { logCall } from "../../actions";

export default function LogCallModal({
  contactId,
  onClose,
}: {
  contactId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Kein <form action={fn}>: unter React 18 wird eine lokale (nicht als "use server"
  // markierte) Funktion dort NICHT als Formular-Action erkannt — der Klick löste
  // stattdessen ein natives Form-Submit/Reload aus und logCall wurde nie ausgeführt.
  // Zusätzlich mussten die Feldnamen exakt zu logCall() passen (call_type/
  // interest_expressed/called_at/summary) — vorher hießen sie call_result/
  // call_date/call_time/notes, wodurch logCall() immer "Zusammenfassung fehlt" lieferte.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await logCall(contactId, formData);
      if (result.success) {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-full rounded-xl bg-white p-6 shadow-xl sm:max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Anruf protokollieren</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Anruf-Typ</label>
            <select
              name="call_type"
              required
              defaultValue="opening_call"
              className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="opening_call">Opening-Call</option>
              <option value="follow_up_call">Follow-Up</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Interesse bekundet</label>
            <select
              name="interest_expressed"
              defaultValue=""
              className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— unklar —</option>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Datum/Uhrzeit</label>
            <input
              name="called_at"
              type="datetime-local"
              required
              defaultValue={new Date().toISOString().slice(0, 16)}
              className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Zusammenfassung</label>
            <textarea
              name="summary"
              rows={3}
              required
              className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Worüber wurde gesprochen?"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
