"use client";

import { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Contact, ContactFilters, ContactSortKey, SortDir } from "../types";
import StatusBadge from "./StatusBadge";
import ContactRowActions from "./ContactRowActions";
import { Card } from "@/components/ui/Card";
import { loadMoreContacts } from "../actions";

const LOAD_BATCH_SIZE = 100;

// Dedupliziert nach id — verhindert React "duplicate key"-Fehler, wenn range()-Pagination
// (z. B. bei instabiler Sortierung) dieselbe Zeile mehrfach zurückliefert.
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

const ContactRow = memo(function ContactRow({
  contact,
  contactHref,
  isAdmin,
  teamMembers,
}: {
  contact: Contact;
  contactHref: string;
  isAdmin: boolean;
  teamMembers: any[];
}) {
  const stopPropagation = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation(), []);

  return (
    <tr className="group transition-colors duration-150 hover:bg-muted/40">
      <td className="truncate px-3 py-2">
        <Link
          href={contactHref}
          scroll={false}
          className="block truncate font-medium text-foreground transition-colors group-hover:text-accent group-hover:underline"
        >
          {contact.first_name} {contact.last_name}
        </Link>
      </td>

      <td className="truncate px-3 py-2" onClick={stopPropagation}>
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className="text-foreground/90 hover:text-accent hover:underline">
            {contact.phone}
          </a>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      <td className="truncate px-3 py-2" onClick={stopPropagation}>
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="text-foreground/90 hover:text-accent hover:underline">
            {contact.email}
          </a>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      <td className="truncate px-3 py-2 text-foreground/90">{contact.company ?? "—"}</td>

      <td className="truncate px-3 py-2 text-foreground/90">{contact.industry ?? "—"}</td>

      <td className="truncate px-3 py-2 text-foreground/90">{contact.country ?? "—"}</td>

      <td className="truncate px-3 py-2 text-foreground/90">{contact.address ?? "—"}</td>

      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateDE(contact.created_at)}</td>

      <td className="overflow-hidden px-3 py-2">
        {contact.currentStage ? (
          <span
            className="inline-flex max-w-full items-center truncate whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: `${contact.currentStage.color}1A`, color: contact.currentStage.color }}
            title={contact.currentStage.name}
          >
            {contact.currentStage.name}
          </span>
        ) : (
          <StatusBadge status={contact.status} />
        )}
      </td>

      <td className="px-3 py-2 text-right">
        <ContactRowActions contact={contact} isAdmin={isAdmin} teamMembers={teamMembers} />
      </td>
    </tr>
  );
});

const COLUMNS: { key: ContactSortKey; label: string; width: string }[] = [
  { key: "name", label: "Name", width: "w-[12%]" },
  { key: "phone", label: "Telefon", width: "w-[10%]" },
  { key: "email", label: "E-Mail", width: "w-[15%]" },
  { key: "company", label: "Firma", width: "w-[11%]" },
  { key: "industry", label: "Branche", width: "w-[10%]" },
  { key: "country", label: "Land", width: "w-[7%]" },
  { key: "address", label: "Adresse", width: "w-[10%]" },
  { key: "createdAt", label: "Erstellt am", width: "w-[8%]" },
  { key: "status", label: "Status", width: "w-[9%]" },
];

export default function ContactsTable({
  contacts,
  isAdmin,
  teamMembers,
  totalCount,
}: {
  contacts: Contact[];
  isAdmin: boolean;
  teamMembers: any[];
  totalCount: number;
}) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") || "";

  const [localContacts, setLocalContacts] = useState<Contact[]>(() => dedupeById(contacts));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Sortierung wird serverseitig (vor .range()) angewendet — siehe getContacts/loadMoreContacts
  // in data.ts/actions.ts — damit "Mehr laden" den global sortierten Bestand fortsetzt.
  const [sortKey, setSortKey] = useState<ContactSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    setLocalContacts(dedupeById(contacts));
  }, [contacts]);

  const hasMore = localContacts.length < totalCount;

  // Append: neue 100 Einträge werden HINTER den bereits sichtbaren gerendert,
  // die Tabelle wird nicht ersetzt. Gleicher sortKey/sortDir wie der bisherige Bestand.
  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    const filters: ContactFilters = { q: currentQuery || undefined };
    const result = await loadMoreContacts(localContacts.length, filters, LOAD_BATCH_SIZE, sortKey ?? undefined, sortDir);
    if (result.success && result.data) {
      setLocalContacts((prev) => dedupeById([...prev, ...(result.data as Contact[])]));
    }
    setIsLoadingMore(false);
  }, [localContacts.length, currentQuery, sortKey, sortDir]);

  // Sortierwechsel: von vorn (offset 0) neu und GLOBAL sortiert laden, nicht nur
  // die bereits im Speicher befindlichen ~100 Zeilen lokal umsortieren.
  const handleSortChange = useCallback(
    (key: ContactSortKey) => {
      let nextKey: ContactSortKey | null = key;
      let nextDir: SortDir = "asc";
      if (sortKey === key) {
        if (sortDir === "asc") {
          nextDir = "desc";
        } else {
          nextKey = null;
        }
      }
      setSortKey(nextKey);
      setSortDir(nextDir);
      setIsLoadingMore(true);

      const filters: ContactFilters = { q: currentQuery || undefined };
      loadMoreContacts(0, filters, LOAD_BATCH_SIZE, nextKey ?? undefined, nextDir).then((result) => {
        if (result.success && result.data) {
          setLocalContacts(dedupeById(result.data));
        }
        setIsLoadingMore(false);
      });
    },
    [sortKey, sortDir, currentQuery]
  );

  if (localContacts.length === 0) {
    return (
      <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
        Keine Kontakte gefunden.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <table className="w-full table-fixed text-xs">
          <thead className="bg-muted/30">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className={`${col.width} px-3 py-2 text-left font-medium text-muted-foreground`}>
                  <button type="button" onClick={() => handleSortChange(col.key)} className="truncate hover:text-foreground">
                    {col.label}
                  </button>
                </th>
              ))}
              <th className="w-[8%] px-3 py-2 text-right font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {localContacts.map((contact) => {
              const params = new URLSearchParams(searchParams.toString());
              if (currentQuery) params.set("q", currentQuery);
              params.set("contactId", contact.id);
              const contactHref = `/dashboard/kontakte?${params.toString()}`;

              return (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  contactHref={contactHref}
                  isAdmin={isAdmin}
                  teamMembers={teamMembers}
                />
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Zeige {localContacts.length} von {totalCount} Kontakten
        </span>

        {hasMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="ring-focus rounded-md bg-accent px-4 py-1.5 font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
          >
            {isLoadingMore ? "Lädt…" : `Mehr laden (+${Math.min(LOAD_BATCH_SIZE, totalCount - localContacts.length)})`}
          </button>
        )}
      </div>
    </div>
  );
}
