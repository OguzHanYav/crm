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
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-foreground">System-Info</h3>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Erstellt am</dt>
          <dd className="text-foreground">{formatDateDE(contact.created_at)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Zuletzt kontaktiert</dt>
          <dd className="text-foreground">{formatDateDE(contact.last_contacted_at)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Sales Rep</dt>
          <dd className="text-foreground">
            {contact.assigned_profile
              ? `${contact.assigned_profile.first_name} ${contact.assigned_profile.last_name}`
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
