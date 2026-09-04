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

  function handleSubmit(formData: FormData) {
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
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Anruf protokollieren</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form action={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Zusammenfassung
            </label>
            <textarea
              name="summary"
              rows={3}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Worüber wurde gesprochen?"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Dauer (Minuten)
            </label>
            <input
              name="duration_minutes"
              type="number"
              min="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
