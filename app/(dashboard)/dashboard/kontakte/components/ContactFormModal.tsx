"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createContact, updateContact, type ActionResult } from "../actions";
import { CONTACT_STATUSES, type Contact, type TeamMember } from "../types";
import { getPipelineStageOptions, type PipelineStageOptions } from "../pipeline-options";
import { COUNTRIES } from "@/lib/constants/countries";
import { countryFromPhone, dialCodeForCountry, splitInternationalNumber } from "@/lib/constants/dial-codes";

// Häufigste Länder oben, alle weiteren darunter.
const COMMON_COUNTRIES = ["Deutschland", "Österreich", "Schweiz", "Türkei", "Liechtenstein", "Luxemburg"];
const OTHER_COUNTRIES = COUNTRIES.filter((c) => !COMMON_COUNTRIES.includes(c));

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

  // Neue Kontakte: Pipeline + Dealphase statt Status (Daten des aktiven Mandanten).
  const [pipelineOptions, setPipelineOptions] = useState<PipelineStageOptions | null>(null);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");

  useEffect(() => {
    if (mode !== "create" || !isOpen || pipelineOptions) return;
    let cancelled = false;
    getPipelineStageOptions().then((options) => {
      if (cancelled) return;
      setPipelineOptions(options);
      setPipelineId(options.defaultPipelineId ?? "");
      setStageId(options.defaultStageId ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [mode, isOpen, pipelineOptions]);

  // Dealphasen der Pipeline, in der "Neuer Kunde" liegt (ohne eigene Pipeline-Auswahl).
  const stagesForPipeline = (pipelineOptions?.stages ?? []).filter((s) => s.pipelineId === pipelineId);

  // Land steht vor der Telefonnummer und bestimmt die Vorwahl (fester Prefix).
  const [country, setCountry] = useState("Deutschland");
  const [localNumber, setLocalNumber] = useState("");
  const dialCode = dialCodeForCountry(country);

  // Tippt jemand selbst "+43 664…" / "0043…", wird das Land passend umgestellt
  // und im Feld bleibt nur die Rufnummer — so entsteht keine doppelte Vorwahl.
  function handlePhoneInput(value: string) {
    const split = splitInternationalNumber(value);
    const splitCountry = split ? countryFromPhone(split.code) : null;
    if (split && splitCountry) {
      setCountry(splitCountry);
      setLocalNumber(split.rest);
    } else {
      setLocalNumber(value);
    }
  }

  // Gespeichert wird E.164 ohne Leerzeichen, z. B. +491721234567.
  const composedPhone = (() => {
    const raw = localNumber.trim();
    if (!raw) return "";
    if (/^(\+|00)/.test(raw)) return "+" + raw.replace(/^(\+|00)/, "").replace(/\D/g, "");
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
    if (!digits) return "";
    if (!dialCode) return digits;
    // Vorwahl ohne "+" schon mit eingetippt (z. B. "49172…" bei Deutschland)? Nicht doppeln.
    const codeDigits = dialCode.slice(1);
    const withoutCode = digits.startsWith(codeDigits) && digits.length > codeDigits.length + 6 ? digits.slice(codeDigits.length) : digits;
    return `${dialCode}${withoutCode}`;
  })();

  // Bestehender, nicht gelisteter Wert (z. B. "Almanya") bleibt beim Bearbeiten auswählbar.
  const currentCountry = contact?.country ?? "";
  const countryIsListed = !currentCountry || COUNTRIES.includes(currentCountry);

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
                <label htmlFor="contact-country" className="mb-1 block text-xs font-medium text-foreground/70">Land</label>
                <select
                  id="contact-country"
                  name="country"
                  autoComplete="country-name"
                  {...(mode === "create"
                    ? {
                        value: country,
                        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setCountry(e.target.value),
                      }
                    : { defaultValue: currentCountry })}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                >
                  {mode === "edit" && <option value="">— kein Land —</option>}
                  {!countryIsListed && <option value={currentCountry}>{currentCountry}</option>}
                  <optgroup label="Häufig">
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Weitere Länder">
                    {OTHER_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {mode === "create" ? (
                <div>
                  <label htmlFor="contact-phone" className="mb-1 block text-xs font-medium text-foreground/70">Telefonnummer</label>
                  {/* Ein Feld: fester Vorwahl-Prefix (aus dem Land) + Rufnummer */}
                  <div className="flex items-center overflow-hidden rounded-md border border-border-strong bg-transparent focus-within:ring-2 focus-within:ring-indigo-500">
                    {dialCode && (
                      <span
                        className="flex-none select-none self-stretch border-r border-border-strong bg-muted/60 px-3 py-2 text-sm tabular-nums text-muted-foreground"
                        title={country}
                      >
                        {dialCode}
                      </span>
                    )}
                    <input
                      id="contact-phone"
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={localNumber}
                      onChange={(e) => handlePhoneInput(e.target.value)}
                      placeholder={dialCode ? "172 1234567" : "+… vollständige Nummer"}
                      className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
                    />
                  </div>
                  <input type="hidden" name="phone" value={composedPhone} />
                </div>
              ) : (
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
              )}

              {mode === "create" ? (
                <div>
                  <input type="hidden" name="status" value="Lead" />
                  <div>
                    <label htmlFor="contact-stage" className="mb-1 block text-xs font-medium text-foreground/70">Dealphase</label>
                    <select
                      id="contact-stage"
                      name="stage_id"
                      autoComplete="off"
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
                      disabled={stagesForPipeline.length === 0}
                      className="w-full rounded-md border border-border-strong px-3 py-2 text-sm disabled:opacity-60"
                    >
                      {stagesForPipeline.length === 0 && <option value="">Neuer Kunde</option>}
                      {stagesForPipeline.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
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
              )}

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
