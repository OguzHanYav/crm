"use client";

import { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Contact, ContactFilters, ContactSortKey, SortDir } from "../types";
import ContactRowActions from "./ContactRowActions";
import { Card } from "@/components/ui/Card";
import { loadMoreContacts } from "../actions";

const LOAD_BATCH_SIZE = 100;

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span className="text-muted-foreground/40">↕</span>;
  return <span className="text-foreground">{dir === "asc" ? "↑" : "↓"}</span>;
}

// Dedupliziert nach id — verhindert React "duplicate key"-Fehler, wenn range()-Pagination
// (z. B. bei instabiler Sortierung) dieselbe Zeile mehrfach zurückliefert.
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
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
      <td className="px-4 py-3">
        <Link href={contactHref} scroll={false} className="block">
          <p className="font-medium text-foreground transition-colors group-hover:text-accent group-hover:underline">
            {contact.first_name} {contact.last_name}
          </p>
        </Link>
      </td>

      <td className="px-4 py-3 text-foreground/90">{contact.company ?? "—"}</td>

      <td className="px-4 py-3 text-foreground/90">{contact.country ?? "—"}</td>

      <td className="px-4 py-3" onClick={stopPropagation}>
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="text-foreground/90 hover:text-accent hover:underline">
            {contact.email}
          </a>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      <td className="px-4 py-3" onClick={stopPropagation}>
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className="text-foreground/90 hover:text-accent hover:underline">
            {contact.phone}
          </a>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <ContactRowActions contact={contact} isAdmin={isAdmin} teamMembers={teamMembers} />
      </td>
    </tr>
  );
});

const COLUMNS: { key: ContactSortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company", label: "Firma" },
  { key: "country", label: "Land" },
  { key: "email", label: "E-Mail" },
  { key: "phone", label: "Telefon" },
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
      <Card className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/30">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleSortChange(col.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    <SortIcon dir={sortKey === col.key ? sortDir : null} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Aktionen</th>
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
