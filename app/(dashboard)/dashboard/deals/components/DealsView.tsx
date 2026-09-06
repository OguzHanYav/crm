"use client";

import { useMemo, useState, useEffect, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Deal, DealStage, PipelinePhase } from "../types";
import DealsTable from "./DealsTable";
import { updateDealStage } from "../actions";

function resolveTargetStageId(deal: Deal, phase: PipelinePhase, allStages: DealStage[]): string {
  const sameStage = allStages.find(
    (s) => s.pipeline_id === deal.pipeline_id && phase.stageIds.includes(s.id)
  );
  return sameStage?.id ?? phase.defaultStageId;
}

export default function DealsView({
  projectName,
  phases,
  allStages,
  deals,
}: {
  projectName: string;
  phases: PipelinePhase[];
  allStages: DealStage[];
  deals: Deal[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals);

  useEffect(() => {
    setLocalDeals(deals);
  }, [deals]);

  const activeKey = searchParams.get("stage") ?? phases[0]?.key ?? "";
  const activePhase = useMemo(() => phases.find((p) => p.key === activeKey), [phases, activeKey]);

  // Zähler pro Phase beziehen sich immer auf ALLE Deals (unabhängig von der Suche).
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const phase of phases) {
      counts[phase.key] = localDeals.filter((d) => phase.stageIds.includes(d.stage_id)).length;
    }
    return counts;
  }, [localDeals, phases]);

  // Die Suche filtert nur innerhalb der aktuell ausgewählten Phase.
  const dealsForActiveStage = useMemo(() => {
    if (!activePhase) return [];
    const term = search.trim().toLowerCase();
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
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
  }, [localDeals, activePhase, search]);

  const setActiveStage = useCallback(
    (stageKey: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("stage", stageKey);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Verschiebt einen Deal optimistisch in die neue Phase: nur diese eine Zeile
  // wird aktualisiert/aus der aktiven Ansicht entfernt, kein Reload der Seite.
  const moveDeal = useCallback(
    (dealId: string, newPhaseKey: string) => {
      const phase = phases.find((p) => p.key === newPhaseKey);
      if (!phase) return;

      setLocalDeals((current) => {
        const deal = current.find((d) => d.id === dealId);
        if (!deal) return current;

        const targetStageId = resolveTargetStageId(deal, phase, allStages);
        const previous = current;
        const next = current.map((d) => (d.id === dealId ? { ...d, stage_id: targetStageId } : d));

        startTransition(async () => {
          const result = await updateDealStage(dealId, targetStageId);
          if (!result.success) setLocalDeals(previous);
        });

        return next;
      });
    },
    [phases, allStages, startTransition]
  );

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
          <p className="text-sm text-slate-500">{localDeals.length} Deals insgesamt</p>
        </div>

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Pipeline-Einstellungen
        </Link>
      </div>

      {/* Phasen-Tab-Leiste */}
      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {phases.map((phase) => {
          const isActive = phase.key === activeKey;
          const count = stageCounts[phase.key] ?? 0;

          return (
            <button
              key={phase.key}
              type="button"
              onClick={() => setActiveStage(phase.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {phase.name}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Suche innerhalb der aktuellen Phase */}
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche in dieser Phase nach Name, Firma, Telefon oder E-Mail"
          className="w-full max-w-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </div>

      <DealsTable
        deals={dealsForActiveStage}
        phases={phases}
        onStageChange={moveDeal}
        onRowClick={openDeal}
      />
    </div>
  );
}
