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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="flex h-full w-full max-w-full flex-col rounded-none bg-white shadow-xl sm:h-auto sm:max-w-sm sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sm:border-b-0 sm:pb-0">
          <h2 className="text-lg font-semibold text-gray-900">Anruf protokollieren</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form
          id="log-call-form"
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4 sm:flex-none"
        >
          <div>
            <label htmlFor="call-type" className="mb-1 block text-xs font-medium text-gray-600">Anruf-Typ</label>
            <select
              id="call-type"
              name="call_type"
              autoComplete="off"
              required
              defaultValue="opening_call"
              className="min-h-[44px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none"
            >
              <option value="opening_call">Opening-Call</option>
              <option value="follow_up_call">Follow-Up</option>
            </select>
          </div>

          <div>
            <label htmlFor="call-interest" className="mb-1 block text-xs font-medium text-gray-600">Interesse bekundet</label>
            <select
              id="call-interest"
              name="interest_expressed"
              autoComplete="off"
              defaultValue=""
              className="min-h-[44px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none"
            >
              <option value="">— unklar —</option>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </div>

          <div>
            <label htmlFor="call-called-at" className="mb-1 block text-xs font-medium text-gray-600">Datum/Uhrzeit</label>
            <input
              id="call-called-at"
              name="called_at"
              type="datetime-local"
              autoComplete="off"
              required
              defaultValue={new Date().toISOString().slice(0, 16)}
              className="min-h-[44px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="call-summary" className="mb-1 block text-xs font-medium text-gray-600">Zusammenfassung</label>
            <textarea
              id="call-summary"
              name="summary"
              autoComplete="off"
              rows={3}
              required
              className="min-h-[44px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none"
              placeholder="Worüber wurde gesprochen?"
            />
          </div>
        </form>

        {/* Sticky-Footer: Speichern/Abbrechen bleiben auf Mobile über der Tastatur sichtbar. */}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            form="log-call-form"
            disabled={isPending}
            className="flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
