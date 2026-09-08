"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Contact, ContactSortKey, SortDir } from "../types";
import StatusBadge from "./StatusBadge";
import { Card } from "@/components/ui/Card";
import { useCrmStore } from "@/lib/store/useCrmStore";

const LOAD_BATCH_SIZE = 50;
const FIVE_MINUTES = 5 * 60 * 1000;

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
}: {
  contact: Contact;
  contactHref: string;
}) {
  const stopPropagation = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => e.stopPropagation(), []);
  const setContactPreview = useCrmStore((s) => s.setContactPreview);
  // Grunddaten der Zeile sofort in den Store schreiben — das ContactDetailSheet
  // kann Name/E-Mail/Telefon dadurch ohne Wartezeit rendern, während die
  // vollständigen Detaildaten (Deals/Notizen/Aktivitäten) im Hintergrund laden.
  const handleClick = useCallback(() => {
    setContactPreview({
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
    });
  }, [setContactPreview, contact.id, contact.first_name, contact.last_name, contact.email, contact.phone]);

  return (
    <tr className="group transition-colors duration-150 hover:bg-muted/40">
      <td className="truncate px-3 py-2">
        <Link
          href={contactHref}
          scroll={false}
          onClick={handleClick}
          className="block truncate font-medium text-foreground transition-colors group-hover:text-accent group-hover:underline"
        >
          {contact.first_name} {contact.last_name}
        </Link>
      </td>

      <td className="hidden truncate px-3 py-2 sm:table-cell" onClick={stopPropagation}>
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className="text-foreground/90 hover:text-accent hover:underline">
            {contact.phone}
          </a>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      <td className="hidden truncate px-3 py-2 md:table-cell" onClick={stopPropagation}>
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="text-foreground/90 hover:text-accent hover:underline">
            {contact.email}
          </a>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      <td className="hidden truncate px-3 py-2 text-foreground/90 md:table-cell">{contact.company ?? "—"}</td>

      <td className="hidden truncate px-3 py-2 text-foreground/90 lg:table-cell">{contact.industry ?? "—"}</td>

      <td className="hidden truncate px-3 py-2 text-foreground/90 lg:table-cell">{contact.country ?? "—"}</td>

      <td className="hidden truncate px-3 py-2 text-foreground/90 xl:table-cell">{contact.address ?? "—"}</td>

      <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground lg:table-cell">{formatDateDE(contact.created_at)}</td>

      <td className="overflow-hidden px-3 py-2">
        {contact.currentStage ? (
          <span
            className="inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${contact.currentStage.color}1A`, color: contact.currentStage.color }}
            title={contact.currentStage.name}
          >
            {contact.currentStage.name}
          </span>
        ) : (
          <StatusBadge status={contact.status} />
        )}
      </td>
    </tr>
  );
});

const COLUMNS: { key: ContactSortKey; label: string; width: string; visibility: string }[] = [
  { key: "name", label: "Name", width: "w-[12%]", visibility: "" },
  { key: "phone", label: "Telefon", width: "w-[10%]", visibility: "hidden sm:table-cell" },
  { key: "email", label: "E-Mail", width: "w-[15%]", visibility: "hidden md:table-cell" },
  { key: "company", label: "Firma", width: "w-[11%]", visibility: "hidden md:table-cell" },
  { key: "industry", label: "Branche", width: "w-[10%]", visibility: "hidden lg:table-cell" },
  { key: "country", label: "Land", width: "w-[7%]", visibility: "hidden lg:table-cell" },
  { key: "address", label: "Adresse", width: "w-[10%]", visibility: "hidden xl:table-cell" },
  { key: "createdAt", label: "Erstellt am", width: "w-[8%]", visibility: "hidden lg:table-cell" },
  { key: "status", label: "Status", width: "w-[17%]", visibility: "" },
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

  // Sortierung wird serverseitig (vor .range()) angewendet — siehe getContacts in
  // data.ts (Erststeite) bzw. app/api/contacts/route.ts (Mehr laden) — damit
  // "Mehr laden" den global sortierten Bestand fortsetzt.
  const [sortKey, setSortKey] = useState<ContactSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const isDefaultSort = sortKey === null && sortDir === "asc";

  const {
    data,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ["contacts", { q: currentQuery, sortKey, sortDir }] as const,
    initialPageParam: 0,
    // Die erste Seite kommt bereits server-gerendert (Server Component) als
    // `contacts`-Prop — als initialData einspeisen, damit useInfiniteQuery beim
    // Mount NICHT sofort erneut denselben Request feuert. Gilt nur für die
    // Standard-Sortierung, weil nur dafür `contacts` server-seitig geladen wurde.
    initialData: isDefaultSort
      ? () => ({ pages: [dedupeById(contacts)], pageParams: [0] })
      : undefined,
    // "Load More" ruft die Edge Function unter app/api/contacts/route.ts auf
    // (statt einer Server Action) — Vorteil: kein Node.js-Lambda-Cold-Start.
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("offset", String(pageParam));
      params.set("limit", String(LOAD_BATCH_SIZE));
      if (currentQuery) params.set("q", currentQuery);
      if (sortKey) params.set("sortKey", sortKey);
      params.set("sortDir", sortDir);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Kontakte konnten nicht geladen werden.");
      }
      return dedupeById(json.data as Contact[]);
    },
    getNextPageParam: (_lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.length, 0);
      return loaded < totalCount ? loaded : undefined;
    },
    staleTime: FIVE_MINUTES,
  });

  const localContacts = useMemo(() => dedupeById((data?.pages ?? []).flat()), [data]);
  const hasMore = localContacts.length < totalCount;

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  // Sortierwechsel setzt einen neuen Query-Key — useInfiniteQuery lädt Seite 0
  // dafür automatisch neu (global sortiert), statt nur die bereits geladenen
  // Zeilen lokal umzusortieren.
  const handleSortChange = useCallback((key: ContactSortKey) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) return key;
      return sortDir === "asc" ? key : null;
    });
    setSortDir((prevDir) => {
      if (sortKey !== key) return "asc";
      return prevDir === "asc" ? "desc" : "asc";
    });
  }, [sortKey, sortDir]);

  if (localContacts.length === 0) {
    return (
      <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
        Keine Kontakte gefunden.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className={`overflow-x-auto transition-opacity ${isFetching && !isFetchingNextPage ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[720px] table-fixed text-xs">
          <thead className="bg-muted/30">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${col.width} ${col.visibility} px-3 py-2 text-left font-medium text-muted-foreground`}
                >
                  <button
                    type="button"
                    onClick={() => handleSortChange(col.key)}
                    className="flex min-h-[44px] w-full items-center truncate hover:text-foreground"
                  >
                    {col.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {localContacts.map((contact) => {
              const params = new URLSearchParams(searchParams.toString());
              if (currentQuery) params.set("q", currentQuery);
              params.set("contactId", contact.id);
              const contactHref = `/dashboard/kontakte?${params.toString()}`;

              return (
                <ContactRow key={contact.id} contact={contact} contactHref={contactHref} />
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
            disabled={isFetchingNextPage}
            className="ring-focus min-h-[44px] rounded-md bg-accent px-4 py-1.5 font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
          >
            {isFetchingNextPage ? "Lädt…" : `Mehr laden (+${Math.min(LOAD_BATCH_SIZE, totalCount - localContacts.length)})`}
          </button>
        )}
      </div>
    </div>
  );
}
