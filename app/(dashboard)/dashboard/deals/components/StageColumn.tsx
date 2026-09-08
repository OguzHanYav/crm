"use client";

import { useState, useCallback, memo } from "react";
import type { Deal, PipelineStage } from "../types";
import DealCard from "./DealCard";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

const VISIBLE_STEP = 3;

function StageHeader({ stage, count, total }: { stage: PipelineStage; count: number; total: number }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 px-2.5 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="text-xs font-semibold text-foreground">{stage.name}</h3>
        </div>
        <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">{formatEuro(total)}</span>
    </div>
  );
}

function StageColumn({
  stage,
  deals,
  allStages,
  onDropDeal,
  onOpenDeal,
}: {
  stage: PipelineStage;
  deals: Deal[];
  allStages: PipelineStage[];
  onDropDeal: (dealId: string, newStageId: string) => void;
  onOpenDeal: (deal: Deal) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  // Nur die ersten 3 Deals werden gerendert, um die Spalte kompakt zu halten —
  // "Mehr laden" blendet den Rest bei Bedarf ein.
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  const stageTotal = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const visibleDeals = deals.slice(0, visibleCount);
  const hiddenCount = deals.length - visibleDeals.length;

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const dealId = e.dataTransfer.getData("dealId");
      if (dealId) onDropDeal(dealId, stage.id);
    },
    [onDropDeal, stage.id]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex w-60 shrink-0 flex-col rounded-lg border bg-card transition-colors ${
        isDragOver ? "border-accent/60 bg-accent-soft/40" : "border-border/60"
      }`}
    >
      <StageHeader stage={stage} count={deals.length} total={stageTotal} />

      <div className="flex flex-1 flex-col gap-1.5 p-1.5">
        {visibleDeals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            stageColor={stage.color}
            allStages={allStages}
            onStageChange={onDropDeal}
            onOpen={onOpenDeal}
          />
        ))}
        {deals.length === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground/60">Keine Deals</p>
        )}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + VISIBLE_STEP)}
            className="ring-focus mt-0.5 min-h-[32px] rounded-md border border-dashed border-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            Mehr laden (+{Math.min(VISIBLE_STEP, hiddenCount)})
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(StageColumn);
