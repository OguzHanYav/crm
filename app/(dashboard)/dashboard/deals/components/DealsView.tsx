"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Deal, PipelinePhase, DealSortKey, SortDir } from "../types";
import DealsTable from "./DealsTable";
import FilterDropdown from "./FilterDropdown";
import { loadMoreDeals } from "../actions";
import { useCrmStore } from "@/lib/store/useCrmStore";

const LOAD_BATCH_SIZE = 100;
const RENDER_LIMIT_OPTIONS = [25, 50, 100];

// Dedupliziert nach id — verhindert React "duplicate key"-Fehler, wenn range()-Pagination
// (z. B. bei instabiler Sortierung) dieselbe Zeile mehrfach zurückliefert.
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export default function DealsView({
  projectName,
  phases,
  deals,
  totalCount,
  phaseCounts,
}: {
  projectName: string;
  phases: PipelinePhase[];
  deals: Deal[];
  totalCount: number;
  phaseCounts: Record<string, number>;
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

  const activeKey = searchParams.get("stage") ?? phases[0]?.key ?? "";
  const activePhase = useMemo(() => phases.find((p) => p.key === activeKey), [phases, activeKey]);

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of localDeals) {
      const i = d.industry || d.contact?.industry;
      if (i) set.add(i);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [localDeals]);

  // Alle Filter (Tab-Phase, Volltextsuche, Firma, E-Mail/Telefon/Vorwahl, Land) werden UND-verknüpft.
  const dealsForActiveStage = useMemo(() => {
    if (!activePhase) return [];
    const term = search.trim().toLowerCase();
    const company = companyFilter.trim().toLowerCase();
    const contactTerm = contactFilter.trim().toLowerCase();

    return localDeals
      .filter((deal) => activePhase.stageIds.includes(deal.stage_id))
      .filter((deal) => {
        if (!term) return true;
        const contact = deal.contact;
        const haystack = [
          deal.name,
          contact?.first_name,
          contact?.last_name,
          contact?.email,
          contact?.company,
          contact?.phone,
          deal.country || contact?.country,
          deal.industry || contact?.industry,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .filter((deal) => !company || (deal.contact?.company ?? "").toLowerCase().includes(company))
      .filter((deal) => {
        if (!contactTerm) return true;
        const haystack = [deal.contact?.email, deal.contact?.phone].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(contactTerm);
      })
      .filter((deal) => !countryFilter || (deal.country || deal.contact?.country) === countryFilter)
      .filter((deal) => !industryFilter || (deal.industry || deal.contact?.industry) === industryFilter);
  }, [localDeals, activePhase, search, companyFilter, contactFilter, countryFilter, industryFilter]);

  // Keine zusätzliche Anzeige-Kappung mehr — alles, was geladen und gefiltert
  // wurde, wird auch angezeigt. renderLimit bestimmt nur die Nachlade-Schrittweite.
  const renderedDeals = dealsForActiveStage;

  const hasMore = localDeals.length < totalCount;

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
      setIsLoadingMore(true);
      loadMoreDeals(0, LOAD_BATCH_SIZE, nextKey ?? undefined, nextDir).then((result) => {
        if (result.success && result.data) {
          setLocalDeals(dedupeById(result.data));
          setFetchLimit(LOAD_BATCH_SIZE);
        }
        setIsLoadingMore(false);
      });
    },
    [sortKey, sortDir]
  );

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
    <div className="min-h-screen bg-white p-6">
      {/* Kopfzeile */}
      <div className="mb-6 flex items-center justify-between">
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
      <div className="no-scrollbar mb-4 overflow-x-auto">
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
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-4">
          <span>
            Zeige {renderedDeals.length} von {dealsForActiveStage.length} geladen ({fetchLimit} angefragt,
            insgesamt {totalCount} Deals)
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
