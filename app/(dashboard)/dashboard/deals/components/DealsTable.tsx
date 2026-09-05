"use client";

import { useState } from "react";
import type { Deal, DealStage } from "../types";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

export default function DealsTable({
  deals,
  allStages,
  onStageChange,
  onRowClick,
}: {
  deals: Deal[];
  allStages: DealStage[];
  onStageChange: (dealId: string, newStageId: string) => void;
  onRowClick: (deal: Deal) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = deals.length > 0 && selected.size === deals.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(deals.map((d) => d.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
        Keine Deals in dieser Phase.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-[#fefce8]">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-gray-300 accent-blue-600"
              />
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Deal-Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Name / E-Mail</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Firma</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Telefon</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Land</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Erstellt am</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Phase</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Wert</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {deals.map((deal) => {
            const contact = deal.contact;
            return (
              <tr
                key={deal.id}
                onClick={() => onRowClick(deal)}
                className="cursor-pointer transition-colors hover:bg-amber-50/60"
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(deal.id)}
                    onChange={() => toggleOne(deal.id)}
                    className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                  />
                </td>

                <td className="px-4 py-3">
                  <span className="font-semibold text-gray-900">{deal.name}</span>
                </td>

                <td className="px-4 py-3">
                  {contact ? (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-800">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.email && (
                        <span className="text-xs text-gray-500">{contact.email}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">Kein Ansprechpartner</span>
                  )}
                </td>

                <td className="px-4 py-3 text-gray-600">{contact?.company ?? "—"}</td>

                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {contact?.phone ? (
                    <a href={`tel:${contact.phone}`} className="text-sky-500 hover:underline">
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-gray-600">{contact?.country ?? "—"}</td>

                <td className="px-4 py-3 text-gray-500">{formatDateDE(deal.created_at)}</td>

                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={deal.stage_id}
                    onChange={(e) => onStageChange(deal.id, e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600"
                  >
                    {allStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {formatEuro(deal.value)}
                </td>

                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onRowClick(deal)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Öffnen
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}