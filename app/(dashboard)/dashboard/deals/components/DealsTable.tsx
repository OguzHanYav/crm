"use client";

import { memo, useCallback } from "react";
import type { Deal, DealSortKey, SortDir } from "../types";

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span className="text-slate-300">↕</span>;
  return <span className="text-slate-700">{dir === "asc" ? "↑" : "↓"}</span>;
}

const DealsTableRow = memo(function DealsTableRow({
  deal,
  onRowClick,
}: {
  deal: Deal;
  onRowClick: (deal: Deal) => void;
}) {
  const contact = deal.contact;
  const handleRowClick = useCallback(() => onRowClick(deal), [onRowClick, deal]);
  const handleStopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <tr onClick={handleRowClick} className="cursor-pointer transition-colors hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{deal.name}</span>
          {contact && (
            <span className="text-xs text-slate-400">
              {contact.first_name} {contact.last_name}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-700">{contact?.company ?? "—"}</td>

      <td className="px-4 py-3 text-slate-600">{deal.country || contact?.country || "—"}</td>

      <td className="px-4 py-3" onClick={handleStopPropagation}>
        {contact?.email ? (
          <a href={`mailto:${contact.email}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            {contact.email}
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      <td className="px-4 py-3" onClick={handleStopPropagation}>
        {contact?.phone ? (
          <a href={`tel:${contact.phone}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            {contact.phone}
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
});

const COLUMNS: { key: DealSortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company", label: "Firma" },
  { key: "country", label: "Land" },
  { key: "email", label: "E-Mail" },
  { key: "phone", label: "Telefon" },
];

export default function DealsTable({
  deals,
  onRowClick,
  sortKey,
  sortDir,
  onSortChange,
}: {
  deals: Deal[];
  onRowClick: (deal: Deal) => void;
  sortKey: DealSortKey | null;
  sortDir: SortDir;
  onSortChange: (key: DealSortKey) => void;
}) {
  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        Keine Kunden in dieser Phase.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left font-medium text-slate-500">
                <button
                  type="button"
                  onClick={() => onSortChange(col.key)}
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  {col.label}
                  <SortIcon dir={sortKey === col.key ? sortDir : null} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {deals.map((deal) => (
            <DealsTableRow key={deal.id} deal={deal} onRowClick={onRowClick} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
