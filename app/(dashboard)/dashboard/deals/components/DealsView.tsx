"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Deal, PipelinePhase } from "../types";
import DealsTable from "./DealsTable";
import { loadMoreDeals } from "../actions";

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

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [contactFilter, setContactFilter] = useState(""); // E-Mail / Telefon / Vorwahl
  const [countryFilter, setCountryFilter] = useState("");

  const [localDeals, setLocalDeals] = useState<Deal[]>(() => dedupeById(deals));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Steuert nur, wie viele der bereits geladenen/gefilterten Zeilen aktuell gerendert
  // werden (DOM-Performance) — unabhängig von der echten Gesamtzahl und vom Nachladen.
  const [renderLimit, setRenderLimit] = useState(100);

  useEffect(() => {
    setLocalDeals(dedupeById(deals));
  }, [deals]);

  const activeKey = searchParams.get("stage") ?? phases[0]?.key ?? "";
  const activePhase = useMemo(() => phases.find((p) => p.key === activeKey), [phases, activeKey]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of localDeals) {
      if (d.contact?.country) set.add(d.contact.country);
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
          contact?.country,
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
      .filter((deal) => !countryFilter || deal.contact?.country === countryFilter);
  }, [localDeals, activePhase, search, companyFilter, contactFilter, countryFilter]);

  const renderedDeals = useMemo(
    () => dealsForActiveStage.slice(0, renderLimit),
    [dealsForActiveStage, renderLimit]
  );

  const hasMore = localDeals.length < totalCount;

  // Append: der nächste Batch wird HINTER die bereits geladenen Deals gehängt,
  // die Tabelle wird nicht ersetzt.
  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    const result = await loadMoreDeals(localDeals.length, LOAD_BATCH_SIZE);
    if (result.success && result.data) {
      setLocalDeals((prev) => dedupeById([...prev, ...(result.data as Deal[])]));
      // Ohne diese Anhebung blieb das Render-Limit (Standard 100) hart und die neu
      // geladenen Zeilen verschwanden trotz erfolgreichem Nachladen aus der Ansicht.
      setRenderLimit((prev) => prev + LOAD_BATCH_SIZE);
    }
    setIsLoadingMore(false);
  }, [localDeals.length]);

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
          href="/dashboard/settings"
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Pipeline-Einstellungen
        </Link>
      </div>

      {/* Phasen-Tab-Leiste — inaktive Tabs bleiben dezent-neutral, erst der ausgewählte
          Tab nimmt die Hex-Farbe der Phase als Hintergrund/Border-Akzent an. */}
      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
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
                borderColor: isSelected ? phase.color : undefined,
              }}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                isSelected
                  ? "text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {phase.name}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  isSelected ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Erweiterte Filterleiste */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Volltextsuche (Name, Kontakt, Firma, E-Mail, Telefon, Land)"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none lg:col-span-2"
        />

        <select
          value={activeKey}
          onChange={(e) => setActiveStage(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        >
          {phases.map((phase) => (
            <option key={phase.key} value={phase.key}>
              {phase.name}
            </option>
          ))}
        </select>

        <input
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          placeholder="Firma"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />

        <input
          value={contactFilter}
          onChange={(e) => setContactFilter(e.target.value)}
          placeholder="E-Mail / Telefon / Vorwahl"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />

        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        >
          <option value="">Alle Länder</option>
          {countryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <DealsTable deals={renderedDeals} phases={phases} onRowClick={openDeal} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-4">
          <span>
            Zeige {renderedDeals.length} von {dealsForActiveStage.length} (insgesamt {totalCount} Deals)
          </span>
          <div className="flex items-center gap-2">
            <span>Render-Limit</span>
            <select
              value={renderLimit}
              onChange={(e) => setRenderLimit(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
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
            className="rounded-md bg-slate-900 px-4 py-1.5 font-medium text-white disabled:opacity-50"
          >
            {isLoadingMore ? "Lädt…" : `Mehr laden (+${Math.min(LOAD_BATCH_SIZE, totalCount - localDeals.length)})`}
          </button>
        )}
      </div>
    </div>
  );
}
