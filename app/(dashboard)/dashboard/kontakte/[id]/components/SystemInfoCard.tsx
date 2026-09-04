import type { ContactWithRelations } from "../../types";

function formatDateDE(dateString: string | null) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export default function SystemInfoCard({ contact }: { contact: ContactWithRelations }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-gray-800">System-Info</h3>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Erstellt am</dt>
          <dd className="text-gray-800">{formatDateDE(contact.created_at)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Zuletzt kontaktiert</dt>
          <dd className="text-gray-800">{formatDateDE(contact.last_contacted_at)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Sales Rep</dt>
          <dd className="text-gray-800">
            {contact.assigned_profile
              ? `${contact.assigned_profile.first_name} ${contact.assigned_profile.last_name}`
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
