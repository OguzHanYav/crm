"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createContact, updateContact, type ActionResult } from "../actions";
import { CONTACT_STATUSES, type Contact } from "../types";

const initialState: ActionResult<Contact> = { success: false };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Wird gespeichert..." : label}
    </button>
  );
}

type Props =
  | {
      mode: "create";
      triggerLabel: string;
      contact?: undefined;
      onClose?: undefined;
      controlledOpen?: undefined;
    }
  | {
      mode: "edit";
      contact: Contact;
      onClose: () => void;
      controlledOpen: true;
      triggerLabel?: undefined;
    };

export default function ContactFormModal(props: Props) {
  const { mode, contact } = props;
  const [isOpen, setIsOpen] = useState(mode === "edit" ? true : false);
  const router = useRouter();
  const [, startRefresh] = useTransition();

  const action = mode === "create" ? createContact : updateContact;
  const [state, formAction] = useActionState(action, initialState);

  function close() {
    setIsOpen(false);
    if (mode === "edit") props.onClose();
  }

  useEffect(() => {
    if (state.success) {
      startRefresh(() => router.refresh());
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <>
      {mode === "create" && (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          {props.triggerLabel}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {mode === "create" ? "Neuen Kontakt anlegen" : "Kontakt bearbeiten"}
              </h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <form action={formAction} className="flex flex-col gap-3">
              {mode === "edit" && (
                <input type="hidden" name="contact_id" value={contact.id} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Vorname
                  </label>
                  <input
                    name="first_name"
                    required
                    defaultValue={contact?.first_name}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Nachname
                  </label>
                  <input
                    name="last_name"
                    required
                    defaultValue={contact?.last_name}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">E-Mail</label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={contact?.email}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Telefonnummer
                </label>
                <input
                  name="phone"
                  defaultValue={contact?.phone ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Firma</label>
                <input
                  name="company"
                  defaultValue={contact?.company ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                <select
                  name="status"
                  required
                  defaultValue={contact?.status ?? "Lead"}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {CONTACT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notizen</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={contact?.notes ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {state.message && !state.success && (
                <p className="text-xs text-red-600">{state.message}</p>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <SubmitButton label={mode === "create" ? "Kontakt anlegen" : "Speichern"} />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
