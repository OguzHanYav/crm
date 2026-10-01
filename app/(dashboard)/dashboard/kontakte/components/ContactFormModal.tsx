"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createContact, updateContact, type ActionResult } from "../actions";
import { CONTACT_STATUSES, type Contact, type TeamMember } from "../types";

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
      teamMembers: TeamMember[];
      contact?: undefined;
      onClose?: undefined;
      controlledOpen?: undefined;
    }
  | {
      mode: "edit";
      contact: Contact;
      teamMembers: TeamMember[];
      onClose: () => void;
      controlledOpen: true;
      triggerLabel?: undefined;
    };

export default function ContactFormModal(props: Props) {
  const { mode, contact, teamMembers } = props;
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
        // Auf kleinen Displays (iPhone SE …) bleibt die Box innerhalb von 90 % der
        // sichtbaren Höhe: Kopf und Fuß stehen fest, nur die Felder scrollen.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
          <div className="my-auto flex max-h-[90dvh] w-[95%] max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl sm:w-full">
            <div className="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {mode === "create" ? "Neuen Kontakt anlegen" : "Kontakt bearbeiten"}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Schließen"
                className="ring-focus -mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form action={formAction} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {mode === "edit" && (
                <input id="contact-id" type="hidden" name="contact_id" autoComplete="off" value={contact.id} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="contact-first-name" className="mb-1 block text-xs font-medium text-foreground/70">Vorname</label>
                  <input
                    id="contact-first-name"
                    name="first_name"
                    autoComplete="given-name"
                    required
                    defaultValue={contact?.first_name}
                    className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="contact-last-name" className="mb-1 block text-xs font-medium text-foreground/70">Nachname</label>
                  <input
                    id="contact-last-name"
                    name="last_name"
                    autoComplete="family-name"
                    required
                    defaultValue={contact?.last_name}
                    className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-email" className="mb-1 block text-xs font-medium text-foreground/70">E-Mail</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={contact?.email}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="contact-phone" className="mb-1 block text-xs font-medium text-foreground/70">Telefonnummer</label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={contact?.phone ?? ""}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="contact-company" className="mb-1 block text-xs font-medium text-foreground/70">Firma</label>
                <input
                  id="contact-company"
                  name="company"
                  autoComplete="organization"
                  defaultValue={contact?.company ?? ""}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="contact-status" className="mb-1 block text-xs font-medium text-foreground/70">Status</label>
                <select
                  id="contact-status"
                  name="status"
                  autoComplete="off"
                  required
                  defaultValue={contact?.status ?? "Lead"}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                >
                  {CONTACT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-assigned-to" className="mb-1 block text-xs font-medium text-foreground/70">
                  Zugewiesener Sales Rep
                </label>
                <select
                  id="contact-assigned-to"
                  name="assigned_to"
                  autoComplete="off"
                  defaultValue={contact?.assigned_to ?? ""}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                >
                  <option value="">— nicht zugewiesen —</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-notes" className="mb-1 block text-xs font-medium text-foreground/70">Notizen</label>
                <textarea
                  id="contact-notes"
                  name="notes"
                  autoComplete="off"
                  rows={3}
                  defaultValue={contact?.notes ?? ""}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                />
              </div>

              {mode === "create" && (
                <label className="flex items-center gap-2 text-xs font-medium text-foreground/70">
                  <input type="checkbox" name="autoSendWelcome" defaultChecked={false} className="h-4 w-4 rounded border-border-strong" />
                  Willkommens-E-Mail/WhatsApp automatisch senden
                </label>
              )}

              {state.message && !state.success && (
                <p className="text-xs text-red-600">{state.message}</p>
              )}
              </div>

              <div className="sticky bottom-0 z-10 flex flex-none justify-end gap-2 border-t border-border bg-card p-4">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/40"
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
