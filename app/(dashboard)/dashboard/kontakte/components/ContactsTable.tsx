"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Contact, ContactSortKey, SortDir } from "../types";
import StatusBadge from "./StatusBadge";
import { Card } from "@/components/ui/Card";
import { useCrmStore } from "@/lib/store/useCrmStore";

// Dieselbe Konstante existiert (bewusst separat, kein Cross-Import) auch in
// kontakte/data.ts und app/api/contacts/route.ts.
const CONTACTS_PAGE_SIZE = 100;
const FIVE_MINUTES = 5 * 60 * 1000;
// Ab dieser Gesamtzahl zeigt der "Alle laden"-Button einen Performance-Hinweis
// (kein Hard-Block, nur UI-Warnung — siehe handleLoadAll).
const LARGE_LOAD_WARNING_THRESHOLD = 5000;

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
  isSelected,
  onToggleSelected,
}: {
  contact: Contact;
  contactHref: string;
  isSelected: boolean;
  onToggleSelected: (id: string) => void;
}) {
  const stopPropagation = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => e.stopPropagation(), []);
  const setContactPreview = useCrmStore((s) => s.setContactPreview);
  const handleCheckboxChange = useCallback(() => onToggleSelected(contact.id), [onToggleSelected, contact.id]);
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
    <tr className={`group transition-colors duration-150 hover:bg-muted/40 ${isSelected ? "bg-accent-soft/40" : ""}`}>
      <td className="px-3 py-2" onClick={stopPropagation}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          aria-label={`${contact.first_name} ${contact.last_name} auswählen`}
          className="h-4 w-4 rounded border-border accent-accent"
        />
      </td>
      <td className="truncate px-3 py-2" title={`Erstellt am ${formatDateDE(contact.created_at)}`}>
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

      <td
        className="hidden truncate px-3 py-2 text-foreground/90 md:table-cell"
        title={contact.industry ? `Branche: ${contact.industry}` : undefined}
      >
        {contact.company ?? "—"}
      </td>

      <td className="hidden truncate px-3 py-2 text-foreground/90 lg:table-cell" title={contact.address ?? undefined}>
        {contact.country ?? "—"}
      </td>

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
  { key: "name", label: "Name", width: "w-[14%]", visibility: "" },
  { key: "phone", label: "Telefon", width: "w-[14%]", visibility: "hidden sm:table-cell" },
  { key: "email", label: "E-Mail", width: "w-[22%]", visibility: "hidden md:table-cell" },
  { key: "company", label: "Firma", width: "w-[16%]", visibility: "hidden md:table-cell" },
  { key: "country", label: "Land", width: "w-[10%]", visibility: "hidden lg:table-cell" },
  { key: "status", label: "Status", width: "w-[20%]", visibility: "" },
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
      params.set("limit", String(CONTACTS_PAGE_SIZE));
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

  // "Alle laden" ersetzt die Liste komplett (statt anzuhängen) — läuft parallel
  // zum useInfiniteQuery-Cache oben, ohne dessen Paging-Zustand zu verändern.
  const [allOverride, setAllOverride] = useState<{ contacts: Contact[]; total: number } | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadAllError, setLoadAllError] = useState<string | null>(null);

  // Neue Suche/Sortierung (oder eine geänderte Gesamtzahl, z. B. nach dem Löschen)
  // macht eine zuvor geladene "Alle"-Liste ungültig — sonst würde sie veraltete
  // bzw. bereits gelöschte Kontakte weiter anzeigen.
  useEffect(() => {
    setAllOverride(null);
    setLoadAllError(null);
  }, [currentQuery, sortKey, sortDir, totalCount]);

  const displayedContacts = allOverride ? allOverride.contacts : localContacts;
  const effectiveTotalCount = allOverride ? allOverride.total : totalCount;
  const hasMore = displayedContacts.length < effectiveTotalCount;

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const handleLoadAll = useCallback(() => {
    setIsLoadingAll(true);
    setLoadAllError(null);

    (async () => {
      try {
        // Forwardet dieselben Filter wie die Erststeite/ContactsFilterBar
        // (q/status/company/from/to/dealStatus/event) an ?all=true.
        const params = new URLSearchParams();
        params.set("all", "true");
        for (const key of ["q", "status", "company", "from", "to", "dealStatus", "event"]) {
          const value = searchParams.get(key);
          if (value) params.set(key, value);
        }
        if (sortKey) params.set("sortKey", sortKey);
        params.set("sortDir", sortDir);

        const res = await fetch(`/api/contacts?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message ?? "Kontakte konnten nicht vollständig geladen werden.");
        }

        setAllOverride({ contacts: dedupeById(json.contacts as Contact[]), total: json.total as number });
      } catch (err) {
        setLoadAllError(err instanceof Error ? err.message : "Kontakte konnten nicht vollständig geladen werden.");
      } finally {
        setIsLoadingAll(false);
      }
    })();
  }, [searchParams, sortKey, sortDir]);

  // Mehrfachauswahl lebt im globalen Store (statt lokalem State), damit sie über
  // Filter-/Suchwechsel hinweg erhalten bleibt.
  const selectedContactIds = useCrmStore((s) => s.selectedContactIds);
  const toggleContactSelected = useCrmStore((s) => s.toggleContactSelected);
  const setContactIdsSelected = useCrmStore((s) => s.setContactIdsSelected);
  const selectedIdSet = useMemo(() => new Set(selectedContactIds), [selectedContactIds]);

  const visibleSelectedCount = useMemo(
    () => displayedContacts.filter((c) => selectedIdSet.has(c.id)).length,
    [displayedContacts, selectedIdSet]
  );
  const isAllVisibleSelected = displayedContacts.length > 0 && visibleSelectedCount === displayedContacts.length;
  const isSomeVisibleSelected = visibleSelectedCount > 0 && !isAllVisibleSelected;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeVisibleSelected;
    }
  }, [isSomeVisibleSelected]);

  const handleToggleSelectAll = useCallback(() => {
    setContactIdsSelected(
      displayedContacts.map((c) => c.id),
      !isAllVisibleSelected
    );
  }, [displayedContacts, isAllVisibleSelected, setContactIdsSelected]);

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

  if (displayedContacts.length === 0) {
    return (
      <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
        Keine Kontakte gefunden.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className={`overflow-x-auto transition-opacity ${(isFetching && !isFetchingNextPage) || isLoadingAll ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[720px] table-fixed text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="w-[4%] px-3 py-2 text-left font-medium text-muted-foreground">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={isAllVisibleSelected}
                  onChange={handleToggleSelectAll}
                  aria-label="Alle sichtbaren Kontakte auswählen"
                  className="h-4 w-4 rounded border-border accent-accent"
                />
              </th>
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
            {displayedContacts.map((contact) => {
              const params = new URLSearchParams(searchParams.toString());
              if (currentQuery) params.set("q", currentQuery);
              params.set("contactId", contact.id);
              const contactHref = `/dashboard/kontakte?${params.toString()}`;

              return (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  contactHref={contactHref}
                  isSelected={selectedIdSet.has(contact.id)}
                  onToggleSelected={toggleContactSelected}
                />
              );
            })}
          </tbody>
        </table>
      </Card>

      {loadAllError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{loadAllError}</p>
      )}

      {hasMore && effectiveTotalCount > LARGE_LOAD_WARNING_THRESHOLD && (
        <p className="text-xs text-muted-foreground">
          {effectiveTotalCount.toLocaleString("de-DE")} Kontakte werden geladen — das kann einen Moment dauern.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Zeige {displayedContacts.length} von {effectiveTotalCount} Kontakten
        </span>

        {hasMore && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isFetchingNextPage || isLoadingAll}
              className="ring-focus min-h-[44px] rounded-md bg-accent px-4 py-1.5 font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
            >
              {isFetchingNextPage
                ? "Lädt…"
                : `Mehr laden (+${Math.min(CONTACTS_PAGE_SIZE, effectiveTotalCount - displayedContacts.length)})`}
            </button>
            <button
              type="button"
              onClick={handleLoadAll}
              disabled={isLoadingAll || isFetchingNextPage}
              className="ring-focus min-h-[44px] rounded-md border border-border bg-transparent px-4 py-1.5 font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {isLoadingAll ? "Lädt alle…" : "Alle Kontakte laden"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
