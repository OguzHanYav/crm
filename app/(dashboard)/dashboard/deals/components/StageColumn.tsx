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

export default function StageColumn({
  stage,
  deals,
  allStages,
  onDropDeal,
}: {
  stage: DealStage;
  deals: Deal[];
  allStages: DealStage[];
  onDropDeal: (dealId: string, newStageId: string) => void;
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
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-gray-50 transition-colors ${
        isDragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200"
      }`}
    >
      <div className="flex flex-col gap-1 border-b border-gray-200 px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-semibold text-gray-800">{stage.name}</h3>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{deals.length} Deals</span>
          <span className="font-medium">{formatEuro(stageTotal)}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            allStages={allStages}
            onStageChange={(newStageId) => onDropDeal(deal.id, newStageId)}
          />
        ))}
        {deals.length === 0 && (
          <p className="mt-2 text-center text-xs text-gray-400">Keine Deals</p>
        )}
      </div>
    </div>
  );
}
