import { getPipelines, getStagesByPipeline, getDealsByPipeline, getContacts, getTeamMembers } from "./data";
import PipelineSelector from "./components/PipelineSelector";
import TotalValueCard from "./components/TotalValueCard";
import DealsBoard from "./components/DealsBoard";
import NewDealModal from "./components/NewDealModal";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const { pipeline: pipelineParam } = await searchParams;

  const pipelines = await getPipelines();

  if (pipelines.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Keine Pipelines gefunden. Bitte lege zuerst eine Pipeline an.
      </div>
    );
  }

  const selectedPipelineId =
    pipelineParam && pipelines.some((p) => p.id === pipelineParam)
      ? pipelineParam
      : pipelines[0].id;

  const [stages, deals, contacts, teamMembers] = await Promise.all([
    getStagesByPipeline(selectedPipelineId),
    getDealsByPipeline(selectedPipelineId),
    getContacts(),
    getTeamMembers(),
  ]);

  const totalValue = deals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <PipelineSelector pipelines={pipelines} selectedPipelineId={selectedPipelineId} />
          <TotalValueCard totalValue={totalValue} currency="EUR" />
        </div>

        <NewDealModal
          pipelines={pipelines}
          stages={stages}
          contacts={contacts}
          teamMembers={teamMembers}
          defaultPipelineId={selectedPipelineId}
        />
      </div>

      <DealsBoard stages={stages} initialDeals={deals} />
    </div>
  );
}
