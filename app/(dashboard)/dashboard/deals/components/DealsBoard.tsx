"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Deal, PipelineStage } from "../types";
import StageColumn from "./StageColumn";
import DealsActionsBar from "./DealsActionsBar";
import { updateDealStage } from "../actions";

export default function DealsBoard({
  stages,
  initialDeals,
}: {
  stages: PipelineStage[];
  initialDeals: Deal[];
}) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  // Inline-Suche statt Filter-Button/Popover — filtert die bereits geladenen
  // Deals direkt im Board, kein zusätzlicher Klick nötig.
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  const filteredDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deals;
    return deals.filter((d) => {
      const haystack = [d.name, d.contact?.first_name, d.contact?.last_name, d.contact?.company, d.contact?.email, d.contact?.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [deals, search]);

  const moveDeal = useCallback(
    (dealId: string, newStageId: string) => {
      setDeals((current) => {
        const previousDeals = current;
        const next = current.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d));

        startTransition(async () => {
          const result = await updateDealStage(dealId, newStageId);
          if (!result.success) {
            setDeals(previousDeals);
          }
        });

        return next;
      });
    },
    [startTransition]
  );

  const openDeal = useCallback(
    (deal: Deal) => {
      if (!deal.contact_id) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("contactId", deal.contact_id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="flex flex-1 flex-col gap-3">
      <DealsActionsBar search={search} onSearchChange={setSearch} />

      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = filteredDeals.filter((d) => d.stage_id === stage.id);
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
    </div>
  );
}
