"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { Deal, PipelinePhase } from "../types";

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

type SortKey = "name" | "company" | "country" | "phone" | "email" | "status" | "createdAt";
type SortDir = "asc" | "desc";

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span className="text-slate-300">↕</span>;
  return <span className="text-slate-700">{dir === "asc" ? "↑" : "↓"}</span>;
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
      <td className="px-4 py-3">
        <span className="font-medium text-slate-900">{deal.name}</span>
      </td>

      <td className="px-4 py-3">
        {contact ? (
          <div className="flex flex-col">
            <span className="text-slate-800">
              {contact.first_name} {contact.last_name}
            </span>
            <span className="text-xs text-slate-400">{contact.company ?? "—"}</span>
          </div>
        ) : (
          <span className="text-slate-400">Kein Kontakt</span>
        )}
      </td>

      <td className="px-4 py-3 text-slate-600">{deal.country || contact?.country || "—"}</td>

      <td className="px-4 py-3" onClick={handleStopPropagation}>
        {contact?.phone ? (
          <a href={`tel:${contact.phone}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            {contact.phone}
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      <td className="px-4 py-3" onClick={handleStopPropagation}>
        {contact?.email ? (
          <a href={`mailto:${contact.email}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            {contact.email}
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {phase && (
            <span
              className="w-fit whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: `${phase.color}1A`, color: phase.color }}
            >
              {phase.name}
            </span>
          )}
          <span className="text-xs text-slate-400">{formatDateDE(deal.created_at)}</span>
        </div>
      </td>
    </tr>
  );
});

// null/undefined-sichere, alphabetische bzw. numerische (Datum) Sortierung.
function sortDeals(list: Deal[], key: SortKey, dir: SortDir, phases: PipelinePhase[]): Deal[] {
  const mul = dir === "asc" ? 1 : -1;

  if (key === "createdAt") {
    return [...list].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (aTime - bTime) * mul;
    });
  }

  const valueOf = (deal: Deal): string => {
    const contact = deal.contact;
    switch (key) {
      case "name":
        return (deal.name ?? "").toLowerCase();
      case "company":
        return (contact?.company ?? "").toLowerCase();
      case "country":
        return (deal.country || contact?.country || "").toLowerCase();
      case "phone":
        return contact?.phone ?? "";
      case "email":
        return (contact?.email ?? "").toLowerCase();
      case "status":
        return (phases.find((p) => p.stageIds.includes(deal.stage_id))?.name ?? "").toLowerCase();
      default:
        return "";
    }
  };

  return [...list].sort((a, b) => (valueOf(a) || "").localeCompare(valueOf(b) || "") * mul);
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name (Kunde / Deal)" },
  { key: "company", label: "Ansprechpartner / Firma" },
  { key: "country", label: "Land" },
  { key: "phone", label: "Telefonnummer" },
  { key: "email", label: "E-Mail-Adresse" },
];

export default function DealsTable({
  deals,
  phases,
  onRowClick,
}: {
  deals: Deal[];
  phases: PipelinePhase[];
  onRowClick: (deal: Deal) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir("asc");
      } else if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
      }
    },
    [sortKey, sortDir]
  );

  const sortedDeals = useMemo(
    () => (sortKey ? sortDeals(deals, sortKey, sortDir, phases) : deals),
    [deals, sortKey, sortDir, phases]
  );

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
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  {col.label}
                  <SortIcon dir={sortKey === col.key ? sortDir : null} />
                </button>
              </th>
            ))}
            <th className="px-4 py-3 text-left font-medium text-slate-500">
              <span className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  Status
                  <SortIcon dir={sortKey === "status" ? sortDir : null} />
                </button>
                <span className="text-slate-300">/</span>
                <button
                  type="button"
                  onClick={() => toggleSort("createdAt")}
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  Erstellt am
                  <SortIcon dir={sortKey === "createdAt" ? sortDir : null} />
                </button>
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedDeals.map((deal) => (
            <DealsTableRow
              key={deal.id}
              deal={deal}
              phase={phases.find((p) => p.stageIds.includes(deal.stage_id))}
              onRowClick={onRowClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
