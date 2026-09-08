"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelinePhase } from "../types";
import { COUNTRIES } from "@/lib/constants/countries";

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
        className="flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
          <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
        </svg>
        Filter
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
        <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-20 z-50 w-auto min-w-[320px] max-w-full space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px]">
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="filter-phase" className="mb-1 block text-xs font-medium text-gray-500">Phase</label>
              <select
                id="filter-phase"
                name="phase"
                autoComplete="off"
                value={activeKey}
                onChange={(e) => onActiveKeyChange(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {phases.map((phase) => (
                  <option key={phase.key} value={phase.key}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-company" className="mb-1 block text-xs font-medium text-gray-500">Firma</label>
              <input
                id="filter-company"
                name="company"
                autoComplete="organization"
                value={companyFilter}
                onChange={(e) => onCompanyFilterChange(e.target.value)}
                placeholder="Firma"
                className="min-h-[42px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="filter-contact" className="mb-1 block text-xs font-medium text-gray-500">
                E-Mail / Telefon / Vorwahl
              </label>
              <input
                id="filter-contact"
                name="contact"
                autoComplete="off"
                value={contactFilter}
                onChange={(e) => onContactFilterChange(e.target.value)}
                placeholder="z. B. +49 oder name@firma.de"
                className="min-h-[42px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="filter-country" className="mb-1 block text-xs font-medium text-gray-500">Land</label>
              <select
                id="filter-country"
                name="country"
                autoComplete="off"
                value={countryFilter}
                onChange={(e) => onCountryFilterChange(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Alle Länder</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-industry" className="mb-1 block text-xs font-medium text-gray-500">Branche</label>
              <select
                id="filter-industry"
                name="industry"
                autoComplete="off"
                value={industryFilter}
                onChange={(e) => onIndustryFilterChange(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="mt-4 flex justify-between gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={resetFilters}
              disabled={activeCount === 0}
              className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40"
            >
              Filter zurücksetzen
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="min-h-[40px] rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98]"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
