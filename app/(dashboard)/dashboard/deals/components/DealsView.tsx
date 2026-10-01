"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Deal, PipelinePhase, DealSortKey, SortDir } from "../types";
import DealsTable from "./DealsTable";
import FilterDropdown from "./FilterDropdown";
import { loadMoreDeals, loadDealsByCountry, deleteDealsByAdmin } from "../actions";
import { useCrmStore } from "@/lib/store/useCrmStore";
import {
  foldText,
  countryKey,
  countrySearchTerms,
  industryKey,
  industryLabel,
  industrySearchTerms,
  matchesSearch,
} from "@/lib/i18n/multilingual";

const LOAD_BATCH_SIZE = 100;
const RENDER_LIMIT_OPTIONS = [25, 50, 100];

// Dedupliziert nach id — verhindert React "duplicate key"-Fehler, wenn range()-Pagination
// (z. B. bei instabiler Sortierung) dieselbe Zeile mehrfach zurückliefert.
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

// Sortierwert je Spalte — nur für den Land-Filter-Modus, in dem ALLE Deals des
// Landes bereits im Speicher liegen und daher lokal sortiert werden können.
function sortValue(deal: Deal, key: DealSortKey): string {
  const c = deal.contact;
  switch (key) {
    case "name":
      return deal.name ?? "";
    case "company":
      return c?.company ?? "";
    case "country":
      return deal.country || c?.country || "";
    case "phone":
      return c?.phone ?? "";
    case "email":
      return c?.email ?? "";
    case "address":
      return deal.address || c?.address || "";
    case "industry":
      return deal.industry || c?.industry || "";
    case "status":
      return deal.stage_id;
    case "createdAt":
      return deal.created_at;
  }
}

export default function DealsView({
  projectName,
  phases,
  deals,
  totalCount,
  phaseCounts,
  isAdmin = false,
}: {
  projectName: string;
  phases: PipelinePhase[];
  deals: Deal[];
  totalCount: number;
  phaseCounts: Record<string, number>;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filterzustand liegt im globalen Zustand-Store (statt lokalem useState), damit er
  // seitenübergreifend erhalten bleibt und Konsumenten selektiv (statt per Prop-Drilling
  // über den ganzen Baum) nur bei tatsächlicher Änderung ihrer Slice neu rendern.
  const dealsFilters = useCrmStore((s) => s.dealsFilters);
  const setDealsFilter = useCrmStore((s) => s.setDealsFilter);
  const { search, companyFilter, contactFilter, countryFilter, industryFilter } = dealsFilters;
  const setSearch = useCallback((value: string) => setDealsFilter("search", value), [setDealsFilter]);
  const setCompanyFilter = useCallback((value: string) => setDealsFilter("companyFilter", value), [setDealsFilter]);
  const setContactFilter = useCallback((value: string) => setDealsFilter("contactFilter", value), [setDealsFilter]);
  const setCountryFilter = useCallback((value: string) => setDealsFilter("countryFilter", value), [setDealsFilter]);
  const setIndustryFilter = useCallback((value: string) => setDealsFilter("industryFilter", value), [setDealsFilter]);

  const [localDeals, setLocalDeals] = useState<Deal[]>(() => dedupeById(deals));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Sortierung wird serverseitig (vor .range()) angewendet — siehe getAllDeals/loadMoreDeals
  // in data.ts/actions.ts — damit "Mehr laden" den global sortierten Bestand fortsetzt.
  const [sortKey, setSortKey] = useState<DealSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Zwei getrennte Zustände, die sich NIE gegenseitig überschreiben:
  // - fetchLimit: wie viele Datensätze insgesamt vom Server geladen wurden (100, +renderLimit je Klick).
  // - renderLimit: rein die Dropdown-Auswahl (25/50/100) — Seitengröße bzw. Nachlade-Schrittweite,
  //   ausschließlich vom Nutzer über das Dropdown gesetzt.
  const [fetchLimit, setFetchLimit] = useState(LOAD_BATCH_SIZE);
  const [renderLimit, setRenderLimit] = useState(100);

  useEffect(() => {
    setLocalDeals(dedupeById(deals));
  }, [deals]);

  // Land-Filter: Sobald ein Land gewählt ist, werden ALLE passenden Deals (in jeder
  // Sprache, z. B. "Almanya" für "Deutschland") vom Server geladen — sonst würde
  // nur unter den ersten ~100 geladenen Deals gesucht. null = kein Land-Modus.
  const [countryDeals, setCountryDeals] = useState<Deal[] | null>(null);
  const [isCountryLoading, setIsCountryLoading] = useState(false);
  const countryRequestRef = useRef(0);

  useEffect(() => {
    const requestId = ++countryRequestRef.current;
    if (!countryFilter) {
      setCountryDeals(null);
      setIsCountryLoading(false);
      return;
    }
    setIsCountryLoading(true);
    loadDealsByCountry(countryFilter).then((result) => {
      // Ältere Antworten ignorieren, falls inzwischen ein anderes Land gewählt wurde.
      if (requestId !== countryRequestRef.current) return;
      setCountryDeals(result.success && result.data ? dedupeById(result.data) : null);
      setIsCountryLoading(false);
    });
  }, [countryFilter, deals]);

  const baseDeals = countryDeals ?? localDeals;

  const activeKey = searchParams.get("stage") ?? phases[0]?.key ?? "";
  const activePhase = useMemo(() => phases.find((p) => p.key === activeKey), [phases, activeKey]);

  // Branchen sprachunabhängig gruppiert: "Döner Üretimi" und "Döner Produktion"
  // landen in EINER Option (value = sprachneutraler Schlüssel, label = Deutsch).
  const industryOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const d of baseDeals) {
      const i = d.industry || d.contact?.industry;
      if (!i) continue;
      const key = industryKey(i);
      if (!byKey.has(key)) byKey.set(key, industryLabel(i));
    }
    return Array.from(byKey, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, "de")
    );
  }, [baseDeals]);

  // Vorberechnete, sprachneutrale Vergleichswerte je Deal (nur bei geänderten
  // Daten neu), damit Tippen in der Suche nicht jedes Mal alles neu übersetzt.
  const searchIndex = useMemo(() => {
    const index = new Map<string, { haystack: string; country: string; industry: string }>();
    for (const deal of baseDeals) {
      const contact = deal.contact;
      const country = deal.country || contact?.country;
      const industry = deal.industry || contact?.industry;
      const haystack = foldText(
        [
          deal.name,
          contact?.first_name,
          contact?.last_name,
          contact?.email,
          contact?.company,
          contact?.phone,
          ...countrySearchTerms(country),
          ...industrySearchTerms(industry),
        ]
          .filter(Boolean)
          .join(" ")
      );
      index.set(deal.id, { haystack, country: countryKey(country), industry: industryKey(industry) });
    }
    return index;
  }, [baseDeals]);

  // Alle Filter (Tab-Phase, Volltextsuche, Firma, E-Mail/Telefon/Vorwahl, Land, Branche) werden UND-verknüpft.
  // Land/Branche/Suche vergleichen sprachunabhängig (Deutsch <-> Türkisch), siehe lib/i18n/multilingual.ts.
  const dealsForActiveStage = useMemo(() => {
    if (!activePhase) return [];
    const term = search.trim();
    const company = foldText(companyFilter);
    const contactTerm = contactFilter.trim().toLowerCase();
    const country = countryKey(countryFilter);

    return baseDeals
      .filter((deal) => activePhase.stageIds.includes(deal.stage_id))
      .filter((deal) => !term || matchesSearch(searchIndex.get(deal.id)?.haystack ?? "", term))
      .filter((deal) => !company || foldText(deal.contact?.company ?? "").includes(company))
      .filter((deal) => {
        if (!contactTerm) return true;
        const haystack = [deal.contact?.email, deal.contact?.phone].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(contactTerm);
      })
      .filter((deal) => !country || searchIndex.get(deal.id)?.country === country)
      .filter((deal) => !industryFilter || searchIndex.get(deal.id)?.industry === industryFilter);
  }, [baseDeals, searchIndex, activePhase, search, companyFilter, contactFilter, countryFilter, industryFilter]);

  // Im Land-Modus lokal sortieren (vollständige Menge liegt vor); sonst kommt die
  // Reihenfolge bereits sortiert vom Server.
  const sortedDeals = useMemo(() => {
    if (!countryDeals || !sortKey) return dealsForActiveStage;
    const factor = sortDir === "asc" ? 1 : -1;
    return [...dealsForActiveStage].sort((a, b) => {
      const va = sortValue(a, sortKey).trim();
      const vb = sortValue(b, sortKey).trim();
      // Leere Werte in beiden Richtungen ans Ende — wie serverseitig (nullsFirst: false).
      if (!va || !vb) return va === vb ? 0 : va ? -1 : 1;
      return factor * va.localeCompare(vb, "de", { numeric: true, sensitivity: "base" });
    });
  }, [dealsForActiveStage, countryDeals, sortKey, sortDir]);

  // Keine zusätzliche Anzeige-Kappung mehr — alles, was geladen und gefiltert
  // wurde, wird auch angezeigt. renderLimit bestimmt nur die Nachlade-Schrittweite.
  const renderedDeals = sortedDeals;

  const hasMore = !countryDeals && localDeals.length < totalCount;

  // Append: der nächste Batch (Größe = renderLimit) wird HINTER die bereits
  // geladenen Deals gehängt, die Tabelle wird nicht ersetzt. renderLimit selbst
  // bleibt dabei unverändert — nur fetchLimit (Ladefortschritt) wächst.
  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    // Gleicher sortKey/sortDir wie beim bisherigen Bestand — sonst wäre der neue
    // Batch anders sortiert als der Rest und die Reihenfolge bräche wieder.
    const result = await loadMoreDeals(localDeals.length, renderLimit, sortKey ?? undefined, sortDir);
    if (result.success && result.data) {
      setLocalDeals((prev) => dedupeById([...prev, ...(result.data as Deal[])]));
      setFetchLimit((prev) => prev + renderLimit);
    }
    setIsLoadingMore(false);
  }, [localDeals.length, sortKey, sortDir, renderLimit]);

  // Sortierwechsel: von vorn (offset 0) neu und GLOBAL sortiert laden, nicht nur
  // die bereits im Speicher befindlichen ~100 Zeilen lokal umsortieren.
  const handleSortChange = useCallback(
    (key: DealSortKey) => {
      let nextKey: DealSortKey | null = key;
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
      // Land-Modus: alle Treffer sind geladen und werden lokal sortiert (sortedDeals).
      if (countryDeals) return;
      setIsLoadingMore(true);
      loadMoreDeals(0, LOAD_BATCH_SIZE, nextKey ?? undefined, nextDir).then((result) => {
        if (result.success && result.data) {
          setLocalDeals(dedupeById(result.data));
          setFetchLimit(LOAD_BATCH_SIZE);
        }
        setIsLoadingMore(false);
      });
    },
    [sortKey, sortDir, countryDeals]
  );

  // ==================== ADMIN: DEALS LÖSCHEN ====================
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const confirmed = window.confirm(
      `${ids.length} Deal${ids.length === 1 ? "" : "s"} wirklich aus der Pipeline löschen?\n\n` +
        "Die verknüpften Kontakte bleiben erhalten. Das kann nicht rückgängig gemacht werden."
    );
    if (!confirmed) return;

    setIsDeleting(true);
    const result = await deleteDealsByAdmin(ids);
    setIsDeleting(false);
    if (!result.success) {
      alert(result.message ?? "Löschen fehlgeschlagen.");
      return;
    }
    // Sofort lokal entfernen (auch aus dem Land-Modus); router.refresh() aktualisiert
    // danach Gesamtzahl und Phasen-Zähler vom Server.
    const deleted = new Set(ids);
    setLocalDeals((prev) => prev.filter((d) => !deleted.has(d.id)));
    setCountryDeals((prev) => (prev ? prev.filter((d) => !deleted.has(d.id)) : prev));
    setSelectedIds(new Set());
    router.refresh();
  }, [selectedIds, router]);

  const setActiveStage = useCallback(
    (stageKey: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("stage", stageKey);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Öffnet das ContactDetailSheet über die contactId in der URL — dort (nicht mehr
  // in der Tabelle) lässt sich die Pipeline-Phase des Deals ändern.
  const openDeal = useCallback(
    (deal: Deal) => {
      if (!deal.contact_id) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("contactId", deal.contact_id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="w-full min-w-0 max-w-full bg-white p-3 max-sm:pb-0 sm:min-h-screen sm:p-6">
      {/* Kopfzeile */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{projectName}</h1>
          <p className="text-sm text-slate-500">{totalCount.toLocaleString("de-DE")} Deals insgesamt</p>
        </div>

        <Link
          href="/dashboard/settings?tab=pipeline"
          className="flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
        >
          Pipeline-Einstellungen
        </Link>
      </div>

      {/* Phasen-Tab-Leiste als Segmented Control — inaktive Tabs bleiben dezent-neutral,
          erst der ausgewählte Tab nimmt die Hex-Farbe der Phase als Hintergrund an. */}
      <div className="no-scrollbar mb-4 w-full max-w-full overflow-x-auto">
        <div className="flex min-h-[44px] w-fit items-center gap-1 whitespace-nowrap rounded-xl bg-gray-100 p-1">
          {phases.map((phase) => {
            const isSelected = phase.key === activeKey;
            const count = phaseCounts[phase.key] ?? 0;

            return (
              <button
                key={phase.key}
                type="button"
                onClick={() => setActiveStage(phase.key)}
                style={{
                  backgroundColor: isSelected ? phase.color : undefined,
                }}
                className={`flex min-h-[36px] shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  isSelected ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {phase.name}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    isSelected ? "bg-white/25 text-white" : "bg-gray-200/70 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Suche + Filter-Popover */}
      <div className="mb-4 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="deals-search"
          name="search"
          autoComplete="off"
          aria-label="Volltextsuche"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Volltextsuche (Name, Kontakt, Firma, E-Mail, Telefon, Land)"
          className="min-h-[40px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none"
        />

        <FilterDropdown
          phases={phases}
          activeKey={activeKey}
          onActiveKeyChange={setActiveStage}
          companyFilter={companyFilter}
          onCompanyFilterChange={setCompanyFilter}
          contactFilter={contactFilter}
          onContactFilterChange={setContactFilter}
          countryFilter={countryFilter}
          onCountryFilterChange={setCountryFilter}
          industryFilter={industryFilter}
          onIndustryFilterChange={setIndustryFilter}
          industryOptions={industryOptions}
        />
      </div>

      <DealsTable
        deals={renderedDeals}
        phases={phases}
        onRowClick={openDeal}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        selectedIds={isAdmin ? selectedIds : undefined}
        onToggleSelected={isAdmin ? toggleSelected : undefined}
        onToggleSelectAll={isAdmin ? toggleSelectAll : undefined}
      />

      {isAdmin && selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-30 mt-4 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg max-sm:static max-sm:mt-3">
          <span className="text-sm font-medium text-slate-900">
            {selectedIds.size} Deal{selectedIds.size === 1 ? "" : "s"} ausgewählt
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Auswahl aufheben
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="min-h-[40px] rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
            >
              {isDeleting ? "Wird gelöscht…" : "Löschen"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-3 max-sm:gap-2 max-sm:border-t max-sm:border-gray-200 max-sm:bg-white/95 max-sm:px-3 max-sm:pb-14 max-sm:pt-2 max-sm:text-xs max-sm:backdrop-blur">
        <div className="flex items-center gap-4">
          <span>
            {isCountryLoading
              ? "Lade alle Deals für das gewählte Land…"
              : countryDeals
                ? `Zeige ${renderedDeals.length} Deals (${countryDeals.length} im gewählten Land, insgesamt ${totalCount} Deals)`
                : `Zeige ${renderedDeals.length} von ${dealsForActiveStage.length} geladen (${fetchLimit} angefragt, insgesamt ${totalCount} Deals)`}
          </span>
          <div className="flex items-center gap-2">
            <label htmlFor="deals-render-limit">Render-Limit</label>
            <select
              id="deals-render-limit"
              name="renderLimit"
              autoComplete="off"
              value={renderLimit}
              onChange={(e) => setRenderLimit(Number(e.target.value))}
              className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-2 py-1 text-sm transition-colors focus:border-blue-500 focus:outline-none"
            >
              {RENDER_LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98] disabled:opacity-50"
          >
            {isLoadingMore ? "Lädt…" : `Mehr laden (+${Math.min(renderLimit, totalCount - localDeals.length)})`}
          </button>
        )}
      </div>
    </div>
  );
}
