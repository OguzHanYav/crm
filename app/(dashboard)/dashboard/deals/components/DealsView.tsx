"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Deal, DealStage, Pipeline, Contact, TeamMember } from "../types";
import DealsHeader from "./DealsHeader";
import DealsActionsBar from "./DealsActionsBar";
import StageTabs from "./StageTabs";
import DealsTable from "./DealsTable";
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
  const activeStageId = searchParams.get("stage") ?? stages[0]?.id ?? "";

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stages) counts[stage.id] = 0;
    for (const deal of deals) counts[deal.stage_id] = (counts[deal.stage_id] ?? 0) + 1;
    return counts;
  }, [deals, stages]);

  const visibleDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (deal.stage_id !== activeStageId) return false;
      if (!term) return true;
      const haystack = [
        deal.name,
        deal.contact?.first_name,
        deal.contact?.last_name,
        deal.contact?.email,
        deal.contact?.company,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [deals, activeStageId, search]);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function openContact(deal: Deal) {
    if (!deal.contact_id) return;
    updateParams({ contactId: deal.contact_id });
  }

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-[#f8fafc] p-6">
      <DealsHeader pipelineName={activePipeline?.name ?? ""} totalCount={deals.length} />

      <DealsActionsBar search={search} onSearchChange={setSearch} onCreateClick={() => setModalOpen(true)} />

      <StageTabs
        stages={stages}
        counts={stageCounts}
        activeStageId={activeStageId}
        onSelect={(stageId) => updateParams({ stage: stageId })}
      />

      <DealsTable deals={visibleDeals} onRowClick={openContact} />

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
