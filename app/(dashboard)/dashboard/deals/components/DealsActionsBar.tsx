"use client";

import { useState, useRef, useEffect } from "react";

function ChevronIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function DropdownButton({
  label,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50"
      >
        {label}
        <ChevronIcon />
      </button>
      {isOpen && (
        <div className="absolute left-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {children ?? <p className="px-2 py-1 text-xs text-gray-400">Keine Optionen verfügbar.</p>}
        </div>
      )}
    </div>
  );
}

export default function DealsActionsBar({
  search,
  onSearchChange,
  onCreateClick,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onCreateClick: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<"filter" | "columns" | "more" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleMenu(menu: "filter" | "columns" | "more") {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Suche"
            className="w-56 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <DropdownButton label="Filter" isOpen={openMenu === "filter"} onToggle={() => toggleMenu("filter")} />
        <DropdownButton label="Spalten-Optionen" isOpen={openMenu === "columns"} onToggle={() => toggleMenu("columns")} />
      </div>

      <div className="flex items-center gap-2">
        <DropdownButton label="Mehr Optionen" isOpen={openMenu === "more"} onToggle={() => toggleMenu("more")} />

        <button
          type="button"
          onClick={onCreateClick}
          className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Deal erstellen
        </button>
      </div>
    </div>
  );
}
