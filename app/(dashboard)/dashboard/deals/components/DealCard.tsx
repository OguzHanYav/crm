"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Deal, DealStage } from "../types";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export default function DealCard({
  deal,
  allStages,
  onStageChange,
}: {
  deal: Deal;
  allStages: DealStage[];
  onStageChange: (newStageId: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function openSheet(e: React.MouseEvent) {
    // Verhindert Öffnen wenn auf Dropdown geklickt wird
    if ((e.target as HTMLElement).closest("select")) return;
    
    if (!deal.contact_id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("contactId", deal.contact_id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("dealId", deal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={openSheet}
      className="cursor-pointer rounded-md border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-gray-900">{deal.name}</p>

      {deal.contact && (
        <p className="mt-1 text-xs text-gray-500">
          {deal.contact.first_name} {deal.contact.last_name}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-600">
          {formatEuro(deal.value ?? 0)}
        </span>

        {deal.assigned_profile && (
          <div
            title={`${deal.assigned_profile.first_name} ${deal.assigned_profile.last_name}`}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700"
          >
            {initials(deal.assigned_profile.first_name, deal.assigned_profile.last_name)}
          </div>
        )}
      </div>

      <select
        value={deal.stage_id}
        onChange={(e) => onStageChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="mt-2 w-full rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-xs text-gray-600"
      >
        {allStages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
    </div>
  );
}
