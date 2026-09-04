"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Contact } from "../types";
import StatusBadge from "./StatusBadge";
import ContactRowActions from "./ContactRowActions";
import { Card } from "@/components/ui/Card";

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5">
      <path d="M5 4h3l1.5 4-2 1.5c1 2.5 2.5 4 5 5l1.5-2 4 1.5v3c0 1-1 1.5-2 1.5C9.5 18.5 5.5 14.5 4.5 8c-.1-1 .5-2 1.5-2z" strokeLinejoin="round" />
    </svg>
  );
}

export default function ContactsTable({
  contacts,
  isAdmin,
  teamMembers,
}: {
  contacts: Contact[];
  isAdmin: boolean;
  teamMembers: any[];
}) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") || "";

  if (contacts.length === 0) {
    return (
      <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
        Keine Kontakte gefunden.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Telefon</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Firma</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Erstellt am</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {contacts.map((contact) => {
            const params = new URLSearchParams(searchParams.toString());
            if (currentQuery) params.set("q", currentQuery);
            params.set("contactId", contact.id);

            return (
              <tr key={contact.id} className="group transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/kontakte?${params.toString()}`}
                    scroll={false}
                    className="block"
                  >
                    <p className="font-medium text-foreground group-hover:text-accent group-hover:underline">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{contact.email}</p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="ring-focus inline-flex items-center gap-1.5 rounded-md text-foreground/80 transition-colors hover:text-accent"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <IconPhone />
                      </span>
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground/90">{contact.company ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={contact.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateDE(contact.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <ContactRowActions contact={contact} isAdmin={isAdmin} teamMembers={teamMembers} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
