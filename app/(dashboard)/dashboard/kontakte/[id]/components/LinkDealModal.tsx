"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createDeal } from "../../../deals/actions";
import type { ContactWithRelations, TeamMember } from "../../types";
import type { Pipeline, DealStage } from "../../../deals/types";

export default function LinkDealModal({
  contact,
  teamMembers,
  pipelines,
  stages,
  defaultPipelineId,
  defaultStageId,
  onClose,
}: {
  contact: ContactWithRelations;
  teamMembers: TeamMember[];
  pipelines: Pipeline[];
  stages: DealStage[];
  defaultPipelineId?: string;
  defaultStageId?: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState(defaultPipelineId || "");
  const router = useRouter();

  const availableStages = stages.filter((s) => s.pipeline_id === selectedPipelineId);

  function handleSubmit(formData: FormData) {
    formData.set("contact_id", contact.id);
    startTransition(async () => {
      const result = await createDeal({ success: false }, formData);
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.message ?? "Fehler beim Anlegen des Deals.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Neuen Deal verknüpfen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form action={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="contact_id" value={contact.id} />

          <div>
            <label htmlFor="linkdeal-pipeline" className="mb-1 block text-xs font-medium text-gray-600">Pipeline</label>
            <select
              id="linkdeal-pipeline"
              name="pipeline_id"
              autoComplete="off"
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Pipeline wählen —</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="linkdeal-stage" className="mb-1 block text-xs font-medium text-gray-600">Phase</label>
            <select
              id="linkdeal-stage"
              name="stage_id"
              autoComplete="off"
              required
              defaultValue={defaultStageId || ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Phase wählen —</option>
              {availableStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="linkdeal-title" className="mb-1 block text-xs font-medium text-gray-600">Titel</label>
            <input
              id="linkdeal-title"
              name="title"
              autoComplete="off"
              required
              defaultValue={`Deal – ${contact.first_name} ${contact.last_name}`}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="linkdeal-value" className="mb-1 block text-xs font-medium text-gray-600">Wert (€)</label>
            <input
              id="linkdeal-value"
              name="value"
              type="number"
              autoComplete="off"
              min="0"
              step="0.01"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="linkdeal-assigned-to" className="mb-1 block text-xs font-medium text-gray-600">
              Zugewiesen an
            </label>
            <select
              id="linkdeal-assigned-to"
              name="assigned_to"
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— nicht zugewiesen —</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

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
              {isPending ? "Wird angelegt..." : "Deal anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
