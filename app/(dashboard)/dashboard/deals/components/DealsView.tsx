"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Deal, PipelineStage } from "../types";
import DealsHeader from "./DealsHeader";
import DealsActionsBar from "./DealsActionsBar";
import StageTabs from "./StageTabs";
import DealsTable from "./DealsTable";
import { updateDealPipelineStage } from "../actions";

export default function DealsView({
  projectName,
  stages,
  deals,
}: {
  projectName: string;
  stages: PipelineStage[];
  deals: Deal[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");

  // Echtzeit-Filterung über Name, E-Mail, Firma, Telefon und Land.
  const filteredDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deals;
    return deals.filter((deal) => {
      const contact = deal.contact;
      const haystack = [
        deal.name,
        contact?.first_name,
        contact?.last_name,
        contact?.email,
        contact?.company,
        contact?.phone,
        contact?.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [deals, search]);

  // Zähler in den Phase-Tabs folgen dem aktuellen Suchergebnis.
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stages) counts[stage.id] = 0;
    for (const deal of filteredDeals) {
      if (deal.pipeline_stage_id && counts[deal.pipeline_stage_id] !== undefined) {
        counts[deal.pipeline_stage_id] += 1;
      }
    }
    return counts;
  }, [filteredDeals, stages]);

  const updateParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const moveDeal = useCallback(
    async (dealId: string, newStageId: string) => {
      await updateDealPipelineStage(dealId, newStageId);
      router.refresh();
    },
    [router]
  );

  const openDeal = useCallback(
    (deal: Deal) => {
      if (!deal.contact_id) return;
      updateParams({ contactId: deal.contact_id });
    },
    [updateParams]
  );

  const activeStageId = searchParams.get("stage") ?? stages[0]?.id ?? "";

  const dealsForActiveStage = useMemo(
    () => filteredDeals.filter((d) => d.pipeline_stage_id === activeStageId),
    [filteredDeals, activeStageId]
  );

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-6">
      <DealsHeader pipelineName={projectName} totalCount={filteredDeals.length} />

      <DealsActionsBar search={search} onSearchChange={setSearch} />

      <StageTabs
        stages={stages}
        counts={stageCounts}
        activeStageId={activeStageId}
        onSelect={(stageId) => updateParams({ stage: stageId })}
      />

      <DealsTable
        deals={dealsForActiveStage}
        allStages={stages}
        onStageChange={moveDeal}
        onRowClick={openDeal}
      />
    </div>
  );
}