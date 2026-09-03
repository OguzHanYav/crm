"use client";

import { useState, useTransition } from "react";
import type { Deal, DealStage } from "../types";
import StageColumn from "./StageColumn";
import { updateDealStage } from "../actions";

export default function DealsBoard({
  stages,
  initialDeals,
}: {
  stages: DealStage[];
  initialDeals: Deal[];
}) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [, startTransition] = useTransition();

  async function moveDeal(dealId: string, newStageId: string) {
    const previousDeals = deals;

    setDeals((current) =>
      current.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d))
    );

    startTransition(async () => {
      const result = await updateDealStage(dealId, newStageId);
      if (!result.success) {
        setDeals(previousDeals);
      }
    });
  }

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage_id === stage.id);
        return (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={stageDeals}
            allStages={stages}
            onDropDeal={moveDeal}
          />
        );
      })}
    </div>
  );
}
