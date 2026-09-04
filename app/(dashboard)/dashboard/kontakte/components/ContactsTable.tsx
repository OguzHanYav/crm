"use client";

import Link from "next/link";
import type { Contact } from "../types";
import StatusBadge from "./StatusBadge";
import ContactRowActions from "./ContactRowActions";

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

export default function ContactsTable({
  contacts,
  isAdmin,
}: {
  contacts: Contact[];
  isAdmin: boolean;
}) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
        Keine Kontakte gefunden.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Telefon</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Firma</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Erstellt am</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {contacts.map((contact) => (
            <tr key={contact.id} className="group hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/kontakte/${contact.id}`}
                  className="block"
                >
                  <p className="font-medium text-gray-900 group-hover:text-indigo-600 group-hover:underline">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{contact.email}</p>
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700">{contact.phone ?? "—"}</td>
              <td className="px-4 py-3 text-gray-700">{contact.company ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={contact.status} />
              </td>
              <td className="px-4 py-3 text-gray-500">{formatDateDE(contact.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <ContactRowActions contact={contact} isAdmin={isAdmin} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
