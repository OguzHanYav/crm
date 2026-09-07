"use client";

import { memo, useCallback, useMemo } from "react";
import type { Deal, PipelinePhase, DealSortKey, SortDir } from "../types";

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

const DealsTableRow = memo(function DealsTableRow({
  deal,
  phase,
  onRowClick,
}: {
  deal: Deal;
  phase: PipelinePhase | undefined;
  onRowClick: (deal: Deal) => void;
}) {
  const contact = deal.contact;
  const handleRowClick = useCallback(() => onRowClick(deal), [onRowClick, deal]);
  const handleStopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <tr onClick={handleRowClick} className="cursor-pointer transition-colors hover:bg-slate-50">
      <td className="truncate px-3 py-2">
        <span className="font-medium text-slate-900">{deal.name}</span>
      </td>

      <td className="hidden truncate px-3 py-2 sm:table-cell" onClick={handleStopPropagation}>
        {contact?.phone ? (
          <a href={`tel:${contact.phone}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            {contact.phone}
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      <td className="hidden truncate px-3 py-2 md:table-cell" onClick={handleStopPropagation}>
        {contact?.email ? (
          <a href={`mailto:${contact.email}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            {contact.email}
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      <td className="hidden truncate px-3 py-2 text-slate-700 md:table-cell">{contact?.company ?? "—"}</td>

      <td className="hidden truncate px-3 py-2 text-slate-600 lg:table-cell">{deal.industry || contact?.industry || "—"}</td>

      <td className="hidden truncate px-3 py-2 text-slate-600 lg:table-cell">{deal.country || contact?.country || "—"}</td>

      <td className="hidden truncate px-3 py-2 text-slate-600 xl:table-cell">{deal.address || contact?.address || "—"}</td>

      <td className="hidden whitespace-nowrap px-3 py-2 text-slate-500 lg:table-cell">{formatDateDE(deal.created_at)}</td>

      <td className="overflow-hidden px-3 py-2">
        {phase && (
          <span
            className="inline-flex max-w-full items-center truncate whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: `${phase.color}1A`, color: phase.color }}
            title={phase.name}
          >
            {phase.name}
          </span>
        )}
      </td>
    </tr>
  );
});

const COLUMNS: { key: DealSortKey; label: string; width: string; visibility: string }[] = [
  { key: "name", label: "Name", width: "w-[13%]", visibility: "" },
  { key: "phone", label: "Telefon", width: "w-[10%]", visibility: "hidden sm:table-cell" },
  { key: "email", label: "E-Mail", width: "w-[15%]", visibility: "hidden md:table-cell" },
  { key: "company", label: "Firma", width: "w-[11%]", visibility: "hidden md:table-cell" },
  { key: "industry", label: "Branche", width: "w-[10%]", visibility: "hidden lg:table-cell" },
  { key: "country", label: "Land", width: "w-[7%]", visibility: "hidden lg:table-cell" },
  { key: "address", label: "Adresse", width: "w-[11%]", visibility: "hidden xl:table-cell" },
  { key: "createdAt", label: "Erstellt am", width: "w-[8%]", visibility: "hidden lg:table-cell" },
  { key: "status", label: "Status", width: "w-[15%]", visibility: "" },
];

export default function DealsTable({
  deals,
  phases,
  onRowClick,
  sortKey,
  sortDir,
  onSortChange,
}: {
  deals: Deal[];
  phases: PipelinePhase[];
  onRowClick: (deal: Deal) => void;
  sortKey: DealSortKey | null;
  sortDir: SortDir;
  onSortChange: (key: DealSortKey) => void;
}) {
  // Vermeidet O(n*m) phases.find(...) pro Zeile bei jedem Render — stattdessen
  // einmalige O(m) Map-Erstellung, danach O(1) Lookup pro Deal.
  const phaseByStageId = useMemo(() => {
    const map = new Map<string, PipelinePhase>();
    for (const phase of phases) {
      for (const stageId of phase.stageIds) {
        map.set(stageId, phase);
      }
    }
    return map;
  }, [phases]);

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        Keine Kunden in dieser Phase.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] table-fixed text-xs">
        <thead className="bg-slate-50">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`${col.width} ${col.visibility} px-3 py-2 text-left font-medium text-slate-500`}
              >
                <button
                  type="button"
                  onClick={() => onSortChange(col.key)}
                  className="flex min-h-[44px] w-full items-center truncate hover:text-slate-700"
                >
                  {col.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {deals.map((deal) => (
            <DealsTableRow
              key={deal.id}
              deal={deal}
              phase={phaseByStageId.get(deal.stage_id)}
              onRowClick={onRowClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
