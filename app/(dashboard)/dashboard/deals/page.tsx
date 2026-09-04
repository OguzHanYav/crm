import { getPipelines, getStagesByPipeline, getDealsByPipeline, getContacts, getTeamMembers } from "./data";
import DealsView from "./components/DealsView";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const { pipeline: pipelineParam } = await searchParams;

  const pipelines = await getPipelines();

  if (pipelines.length === 0) {
    return <div className="p-8 text-center text-gray-500">Keine Pipelines gefunden.</div>;
  }

  const selectedPipelineId =
    pipelineParam && pipelines.some((p) => p.id === pipelineParam) ? pipelineParam : pipelines[0].id;

  const [stages, deals, contacts, teamMembers] = await Promise.all([
    getStagesByPipeline(selectedPipelineId),
    getDealsByPipeline(selectedPipelineId),
    getContacts(),
    getTeamMembers(),
  ]);

  return (
    <>
      <DealsView
        pipelines={pipelines}
        selectedPipelineId={selectedPipelineId}
        stages={stages}
        deals={deals}
        contacts={contacts}
        teamMembers={teamMembers}
      />
      <ContactDetailSheet />
    </>
  );
}
