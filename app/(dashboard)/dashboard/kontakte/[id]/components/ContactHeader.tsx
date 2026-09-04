"use client";

import { useState } from "react";
import type { ContactWithRelations, TeamMember } from "../../types";
import StatusBadge from "../../components/StatusBadge";
import ContactFormModal from "../../components/ContactFormModal";
import LinkDealModal from "./LinkDealModal";
import LogCallModal from "./LogCallModal";
import type { Pipeline, DealStage } from "../../../deals/types";

export default function ContactHeader({
  contact,
  teamMembers,
  pipelines,
  stages,
  defaultPipelineId,
  defaultStageId,
}: {
  contact: ContactWithRelations;
  teamMembers: TeamMember[];
  pipelines: Pipeline[];
  stages: DealStage[];
  defaultPipelineId?: string;
  defaultStageId?: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">
            {contact.first_name} {contact.last_name}
          </h1>
          <StatusBadge status={contact.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {[contact.position, contact.company].filter(Boolean).join(" bei ") || "—"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCallOpen(true)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Anruf protokollieren
        </button>
        <button
          onClick={() => setDealOpen(true)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Neuen Deal verknüpfen
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Kontakt bearbeiten
        </button>
      </div>

      {editOpen && (
        <ContactFormModal
          mode="edit"
          contact={contact}
          onClose={() => setEditOpen(false)}
          controlledOpen
        />
      )}
      {dealOpen && (
        <LinkDealModal
          contact={contact}
          teamMembers={teamMembers}
          pipelines={pipelines}
          stages={stages}
          defaultPipelineId={defaultPipelineId}
          defaultStageId={defaultStageId}
          onClose={() => setDealOpen(false)}
        />
      )}
      {callOpen && <LogCallModal contactId={contact.id} onClose={() => setCallOpen(false)} />}
    </div>
  );
}
