import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getContactById,
  getContactNotes,
  getContactCallLogs,
  getContactDeals,
  getTeamMembers,
  getPipelines,
  getStagesByPipeline,
} from "../data";
import ContactHeader from "./components/ContactHeader";
import ContactInfoCard from "./components/ContactInfoCard";
import SystemInfoCard from "./components/SystemInfoCard";
import ActivityTimeline from "./components/ActivityTimeline";
import DealsList from "./components/DealsList";
import CallHistoryList from "./components/CallHistoryList";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contact = await getContactById(id);
  if (!contact) notFound();

  const [notes, callLogs, deals, teamMembers, pipelines] = await Promise.all([
    getContactNotes(id),
    getContactCallLogs(id),
    getContactDeals(id),
    getTeamMembers(),
    getPipelines(),
  ]);

  // Erste Pipeline und erste Stage für LinkDealModal
  const defaultPipeline = pipelines.length > 0 ? pipelines[0] : null;
  const stages = defaultPipeline ? await getStagesByPipeline(defaultPipeline.id) : [];
  const defaultStage = stages.length > 0 ? stages[0] : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/dashboard/kontakte"
        className="w-fit text-sm text-gray-500 hover:text-gray-800"
      >
        ← Zurück zu Kontakten
      </Link>

      <ContactHeader
        contact={contact}
        teamMembers={teamMembers}
        pipelines={pipelines}
        stages={stages}
        defaultPipelineId={defaultPipeline?.id}
        defaultStageId={defaultStage?.id}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <ContactInfoCard contact={contact} />
          <SystemInfoCard contact={contact} />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Aktivitäten & Notizen
            </h3>
            <ActivityTimeline contactId={id} notes={notes} callLogs={callLogs} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Verknüpfte Deals
            </h3>
            <DealsList deals={deals} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Anrufe (Call History)
            </h3>
            <CallHistoryList callLogs={callLogs} />
          </div>
        </div>
      </div>
    </div>
  );
}
