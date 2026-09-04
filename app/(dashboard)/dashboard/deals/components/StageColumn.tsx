"use client";

import { useState } from "react";
import type { Deal, DealStage } from "../types";
import DealCard from "./DealCard";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function StageHeader({ stage, count, total }: { stage: DealStage; count: number; total: number }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border/60 px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
        </div>
        <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{formatEuro(total)}</span>
    </div>
  );
}

export default function StageColumn({
  stage,
  deals,
  allStages,
  onDropDeal,
  onOpenDeal,
}: {
  stage: DealStage;
  deals: Deal[];
  allStages: DealStage[];
  onDropDeal: (dealId: string, newStageId: string) => void;
  onOpenDeal: (deal: Deal) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const stageTotal = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const dealId = e.dataTransfer.getData("dealId");
        if (dealId) onDropDeal(dealId, stage.id);
      }}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-card/60 transition-colors ${
        isDragOver ? "border-accent/60 bg-accent-soft/40" : "border-border/60"
      }`}
    >
      <StageHeader stage={stage} count={deals.length} total={stageTotal} />

      <div className="flex flex-1 flex-col gap-2 p-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            stageColor={stage.color}
            allStages={allStages}
            onStageChange={(newStageId) => onDropDeal(deal.id, newStageId)}
            onOpen={() => onOpenDeal(deal)}
          />
        ))}
        {deals.length === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground/60">Keine Deals</p>
        )}
      </div>
    </div>
  );
}