"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Deal, PipelineStage } from "../types";
import DealsTable from "./DealsTable";
import { updateDealStage } from "../actions";

export default function DealsView({
  projectName,
  stages,
  deals,
}: {
  projectName: string;
  stages: PipelineStage[];
  deals: Deal[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");

  const activeStageId = searchParams.get("stage") ?? stages[0]?.id ?? "";

  // Zähler pro Phase beziehen sich immer auf ALLE Deals (unabhängig von der Suche).
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stages) counts[stage.id] = 0;
    for (const deal of deals) {
      if (deal.stage_id && counts[deal.stage_id] !== undefined) {
        counts[deal.stage_id] += 1;
      }
    }
    return counts;
  }, [deals, stages]);

  // Die Suche filtert nur innerhalb der aktuell ausgewählten Phase.
  const dealsForActiveStage = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals
      .filter((deal) => deal.stage_id === activeStageId)
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
  }, [deals, activeStageId, search]);

  const setActiveStage = useCallback(
    (stageId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("stage", stageId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const moveDeal = useCallback(
    async (dealId: string, newStageId: string) => {
      await updateDealStage(dealId, newStageId);
      router.refresh();
    },
    [router]
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
          <p className="text-sm text-slate-500">{deals.length} Deals insgesamt</p>
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
        {stages.map((stage) => {
          const isActive = stage.id === activeStageId;
          const count = stageCounts[stage.id] ?? 0;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveStage(stage.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {stage.name}
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
        allStages={stages}
        onStageChange={moveDeal}
        onRowClick={openDeal}
      />
    </div>
  );
}
