"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Deal, DealStage, Pipeline, Contact, TeamMember } from "../types";
import DealsHeader from "./DealsHeader";
import DealsActionsBar from "./DealsActionsBar";
import StageTabs from "./StageTabs";
import StageColumn from "./StageColumn";
import NewDealModal from "./NewDealModal";

export default function DealsView({
  pipelines,
  selectedPipelineId,
  stages,
  deals,
  contacts,
  teamMembers,
}: {
  pipelines: Pipeline[];
  selectedPipelineId: string;
  stages: DealStage[];
  deals: Deal[];
  contacts: Contact[];
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stages) counts[stage.id] = 0;
    for (const deal of deals) counts[deal.stage_id] = (counts[deal.stage_id] ?? 0) + 1;
    return counts;
  }, [deals, stages]);

  const filteredDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deals;
    return deals.filter((deal) => {
      const contact = deal.contact;
      const haystack = [deal.name, contact?.first_name, contact?.last_name, contact?.company]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [deals, search]);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function moveDeal(dealId: string, newStageId: string) {
    const { updateDealStage } = await import("../actions");
    await updateDealStage(dealId, newStageId);
    router.refresh();
  }

  function openContact(deal: Deal) {
    if (!deal.contact_id) return;
    updateParams({ contactId: deal.contact_id });
  }

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-6">
      <DealsHeader pipelineName={activePipeline?.name ?? ""} totalCount={deals.length} />

      <DealsActionsBar search={search} onSearchChange={setSearch} onCreateClick={() => setModalOpen(true)} />

      <StageTabs
        stages={stages}
        counts={stageCounts}
        activeStageId={searchParams.get("stage") ?? stages[0]?.id ?? ""}
        onSelect={(stageId) => updateParams({ stage: stageId })}
      />

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={filteredDeals.filter((d) => d.stage_id === stage.id)}
            allStages={stages}
            onDropDeal={moveDeal}
            onOpenDeal={openContact}
          />
        ))}
      </div>

      {modalOpen && (
        <NewDealModal
          pipelines={pipelines}
          stages={stages}
          contacts={contacts}
          teamMembers={teamMembers}
          defaultPipelineId={selectedPipelineId}
          forceOpen
          onOpenChange={setModalOpen}
        />
      )}
    </div>
  );
}