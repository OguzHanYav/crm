"use client";

import { useState, useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createDeal, type CreateDealState } from "../actions";
import type { Pipeline, DealStage, Contact, TeamMember } from "../types";

const initialState: CreateDealState = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Wird gespeichert..." : "Deal anlegen"}
    </button>
  );
}

export default function NewDealModal({
  pipelines,
  stages,
  contacts,
  teamMembers,
  defaultPipelineId,
}: {
  pipelines: Pipeline[];
  stages: DealStage[];
  contacts: Contact[];
  teamMembers: TeamMember[];
  defaultPipelineId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState(defaultPipelineId);
  const [state, formAction] = useActionState(createDeal, initialState);

  useEffect(() => {
    if (state.success) setIsOpen(false);
  }, [state.success]);

  const availableStages = stages.filter((s) => s.pipeline_id === selectedPipeline);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        + Neuer Deal
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Neuen Deal anlegen</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form action={formAction} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Titel</label>
                <input
                  name="title"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="z. B. Erstgespräch Müller GmbH"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Pipeline</label>
                <select
                  name="pipeline_id"
                  value={selectedPipeline}
                  onChange={(e) => setSelectedPipeline(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Phase</label>
                <select
                  name="stage_id"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {availableStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Kontakt</label>
                <select
                  name="contact_id"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— kein Kontakt —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Wert (€)
                </label>
                <input
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Zugewiesen an
                </label>
                <select
                  name="assigned_to"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— nicht zugewiesen —</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {state.message && (
                <p className="text-xs text-red-600">{state.message}</p>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
