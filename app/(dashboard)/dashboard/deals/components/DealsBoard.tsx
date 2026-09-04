"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // WICHTIG: Wenn page.tsx nach revalidatePath()/router.refresh() neue
  // Server-Daten liefert, ändern sich initialDeals als Prop. useState allein
  // würde das ignorieren (nur beim ersten Mount ausgewertet) – daher hier
  // explizit synchronisieren.
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  async function moveDeal(dealId: string, newStageId: string) {
    const previousDeals = deals;

    // Optimistisches Update für sofortiges Feedback beim Drag & Drop
    setDeals((current) =>
      current.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d))
    );

    startTransition(async () => {
      const result = await updateDealStage(dealId, newStageId);
      if (!result.success) {
        // Rollback bei Fehler
        setDeals(previousDeals);
      }
    });
  }

  function openDeal(deal: Deal) {
    if (!deal.contact_id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("contactId", deal.contact_id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
            onOpenDeal={openDeal}
          />
        );
      })}
    </div>
  );
}
