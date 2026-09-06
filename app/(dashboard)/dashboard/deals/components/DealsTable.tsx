"use client";

import type { Deal, PipelineStage } from "../types";

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
  allStages: PipelineStage[];
  onStageChange: (dealId: string, newStageId: string) => void;
  onRowClick: (deal: Deal) => void;
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
            <th className="px-4 py-3 text-left font-medium text-slate-500">Name (Kunde / Deal)</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Ansprechpartner / Firma</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Telefonnummer</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">E-Mail-Adresse</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Status / Erstellt am</th>
            <th className="px-4 py-3 text-right font-medium text-slate-500">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {deals.map((deal) => {
            const contact = deal.contact;
            const stage = allStages.find((s) => s.id === deal.stage_id);

            return (
              <tr
                key={deal.id}
                onClick={() => onRowClick(deal)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
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

                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {contact?.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>

                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {contact?.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {stage && (
                      <span
                        className="w-fit rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${stage.color}1A`, color: stage.color }}
                      >
                        {stage.name}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{formatDateDE(deal.created_at)}</span>
                  </div>
                </td>

                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <select
                      value={deal.stage_id}
                      onChange={(e) => onStageChange(deal.id, e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-slate-400 focus:outline-none"
                    >
                      {allStages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => onRowClick(deal)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Öffnen
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
