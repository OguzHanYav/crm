"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Contact, ContactFilters } from "../types";
import StatusBadge from "./StatusBadge";
import ContactRowActions from "./ContactRowActions";
import { Card } from "@/components/ui/Card";
import { loadMoreContacts } from "../actions";

const LOAD_BATCH_SIZE = 100;

type SortKey = "name" | "company" | "country" | "status" | "createdAt";
type SortDir = "asc" | "desc";

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span className="text-muted-foreground/40">↕</span>;
  return <span className="text-foreground">{dir === "asc" ? "↑" : "↓"}</span>;
}

// null/undefined-sicherer Vergleich für Text- und Datumsspalten.
function sortContacts(list: Contact[], key: SortKey, dir: SortDir): Contact[] {
  const mul = dir === "asc" ? 1 : -1;

  if (key === "createdAt") {
    return [...list].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (aTime - bTime) * mul;
    });
  }

  const valueOf = (c: Contact): string => {
    switch (key) {
      case "name":
        return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim().toLowerCase();
      case "company":
        return (c.company ?? "").toLowerCase();
      case "country":
        return (c.country ?? "").toLowerCase();
      case "status":
        return (c.currentStage?.name ?? c.status ?? "").toLowerCase();
      default:
        return "";
    }
  };

  return [...list].sort((a, b) => (valueOf(a) || "").localeCompare(valueOf(b) || "") * mul);
}

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

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5">
      <path
        d="M5 4h3l1.5 4-2 1.5c1 2.5 2.5 4 5 5l1.5-2 4 1.5v3c0 1-1 1.5-2 1.5C9.5 18.5 5.5 14.5 4.5 8c-.1-1 .5-2 1.5-2z"
        strokeLinejoin="round"
      />
    </svg>
  );
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
          <p className="text-xs text-muted-foreground">{contact.email}</p>
        </Link>
      </td>

      <td className="px-4 py-3 text-foreground/90">{contact.company ?? "—"}</td>

      <td className="px-4 py-3 text-foreground/90">{contact.country ?? "—"}</td>

      <td className="px-4 py-3">
        {contact.currentStage ? (
          <span
            className="inline-flex w-fit items-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${contact.currentStage.color}1A`, color: contact.currentStage.color }}
          >
            {contact.currentStage.name}
          </span>
        ) : (
          <StatusBadge status={contact.status} />
        )}
      </td>

      <td className="px-4 py-3 text-muted-foreground">{formatDateDE(contact.created_at)}</td>

      <td className="px-4 py-3 text-center">
        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            onClick={stopPropagation}
            title={contact.phone}
            className="ring-focus inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent transition-colors hover:brightness-110"
          >
            <IconPhone />
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

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company", label: "Firma" },
  { key: "country", label: "Land" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Erstellt am" },
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    setLocalContacts(dedupeById(contacts));
  }, [contacts]);

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

  const sortedContacts = useMemo(
    () => (sortKey ? sortContacts(localContacts, sortKey, sortDir) : localContacts),
    [localContacts, sortKey, sortDir]
  );

  const hasMore = localContacts.length < totalCount;

  // Append: neue 100 Einträge werden HINTER den bereits sichtbaren gerendert,
  // die Tabelle wird nicht ersetzt.
  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    const filters: ContactFilters = { q: currentQuery || undefined };
    const result = await loadMoreContacts(localContacts.length, filters, LOAD_BATCH_SIZE);
    if (result.success && result.data) {
      setLocalContacts((prev) => dedupeById([...prev, ...(result.data as Contact[])]));
    }
    setIsLoadingMore(false);
  }, [localContacts.length, currentQuery]);

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
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    <SortIcon dir={sortKey === col.key ? sortDir : null} />
                  </button>
                </th>
              ))}
              <th className="w-16 px-4 py-3 text-center text-xs font-medium text-muted-foreground">Anruf</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedContacts.map((contact) => {
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
