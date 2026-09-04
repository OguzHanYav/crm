"use client";

import { useState } from "react";
import type { Deal } from "../types";

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
  onRowClick,
}: {
  deals: Deal[];
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
            <th className="px-4 py-3 text-left font-medium text-gray-500">Ansprechpartner</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Deal erstellt</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Telefon</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">E-Mail</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Firmenname</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Website</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Zuletzt kontaktiert</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Wert</th>
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
                    <span className="inline-flex items-center gap-1.5 text-gray-600">
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                      {contact.first_name} {contact.last_name}
                    </span>
                  ) : (
                    <span className="text-gray-400">Kein Ansprechpartner</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDateDE(deal.created_at)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {contact?.phone ? (
                    <a href={`tel:${contact.phone}`} className="text-sky-500 hover:underline">
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {contact?.email ? (
                    <span className="text-gray-500">{contact.email}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{contact?.company ?? "—"}</td>
                <td className="px-4 py-3">
                  {contact?.website ? (
                    <span className="text-blue-400">{contact.website}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {contact?.last_contacted_at ? formatDateDE(contact.last_contacted_at) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {formatEuro(deal.value)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
