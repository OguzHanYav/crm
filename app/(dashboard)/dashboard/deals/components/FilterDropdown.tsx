"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelinePhase } from "../types";

export default function FilterDropdown({
  phases,
  activeKey,
  onActiveKeyChange,
  companyFilter,
  onCompanyFilterChange,
  contactFilter,
  onContactFilterChange,
  countryFilter,
  onCountryFilterChange,
  countryOptions,
  industryFilter,
  onIndustryFilterChange,
  industryOptions,
}: {
  phases: PipelinePhase[];
  activeKey: string;
  onActiveKeyChange: (key: string) => void;
  companyFilter: string;
  onCompanyFilterChange: (value: string) => void;
  contactFilter: string;
  onContactFilterChange: (value: string) => void;
  countryFilter: string;
  onCountryFilterChange: (value: string) => void;
  countryOptions: string[];
  industryFilter: string;
  onIndustryFilterChange: (value: string) => void;
  industryOptions: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeCount = [companyFilter.trim(), contactFilter.trim(), countryFilter, industryFilter].filter(
    (v) => v !== ""
  ).length;

  function resetFilters() {
    onCompanyFilterChange("");
    onContactFilterChange("");
    onCountryFilterChange("");
    onIndustryFilterChange("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex min-h-[44px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
          <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
        </svg>
        Filter
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
        <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-20 z-20 w-auto max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Phase</label>
              <select
                value={activeKey}
                onChange={(e) => onActiveKeyChange(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              >
                {phases.map((phase) => (
                  <option key={phase.key} value={phase.key}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Firma</label>
              <input
                value={companyFilter}
                onChange={(e) => onCompanyFilterChange(e.target.value)}
                placeholder="Firma"
                className="min-h-[44px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                E-Mail / Telefon / Vorwahl
              </label>
              <input
                value={contactFilter}
                onChange={(e) => onContactFilterChange(e.target.value)}
                placeholder="z. B. +49 oder name@firma.de"
                className="min-h-[44px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Land</label>
              <select
                value={countryFilter}
                onChange={(e) => onCountryFilterChange(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              >
                <option value="">Alle Länder</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Branche</label>
              <select
                value={industryFilter}
                onChange={(e) => onIndustryFilterChange(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              >
                <option value="">Alle Branchen</option>
                {industryOptions.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={resetFilters}
              disabled={activeCount === 0}
              className="min-h-[44px] rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Filter zurücksetzen
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="min-h-[44px] rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
