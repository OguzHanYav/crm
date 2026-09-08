"use client";

import { memo, useCallback } from "react";
import type { Deal, PipelineStage } from "../types";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
    new Date(dateString)
  );
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

function DealCard({
  deal,
  stageColor,
  allStages,
  onStageChange,
  onOpen,
}: {
  deal: Deal;
  stageColor: string;
  allStages: PipelineStage[];
  onStageChange: (dealId: string, newStageId: string) => void;
  onOpen: (deal: Deal) => void;
}) {
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("dealId", deal.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [deal.id]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("select")) return;
      onOpen(deal);
    },
    [onOpen, deal]
  );

  const handleStageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onStageChange(deal.id, e.target.value);
    },
    [onStageChange, deal.id]
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="group relative cursor-pointer overflow-hidden rounded-md border border-border bg-card p-2 shadow-soft transition-all hover:border-border-strong hover:shadow-card active:cursor-grabbing"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: stageColor }} />

      <div className="pl-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium leading-tight text-foreground">{deal.name}</p>
          {deal.assigned_profile && (
            <div
              title={`${deal.assigned_profile.first_name} ${deal.assigned_profile.last_name}`}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent"
            >
              {initials(deal.assigned_profile.first_name, deal.assigned_profile.last_name)}
            </div>
          )}
        </div>

        {deal.contact && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {deal.contact.first_name} {deal.contact.last_name}
            {deal.contact.company ? ` · ${deal.contact.company}` : ""}
          </p>
        )}

        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-accent">{formatEuro(deal.value ?? 0)}</span>
          <span className="text-[10px] text-muted-foreground/70">{formatDateDE(deal.created_at)}</span>
        </div>

        <select
          id={`deal-stage-${deal.id}`}
          name="stageId"
          autoComplete="off"
          aria-label="Phase ändern"
          value={deal.stage_id}
          onChange={handleStageChange}
          onClick={(e) => e.stopPropagation()}
          className="ring-focus mt-1.5 w-full rounded border border-border bg-muted/40 px-1 py-0.5 text-[10px] text-muted-foreground"
        >
          {allStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function areEqual(prev: Readonly<{ deal: Deal; stageColor: string; allStages: PipelineStage[] }>, next: Readonly<{ deal: Deal; stageColor: string; allStages: PipelineStage[] }>) {
  return (
    prev.deal === next.deal &&
    prev.stageColor === next.stageColor &&
    prev.allStages === next.allStages
  );
}

export default memo(DealCard, areEqual);
