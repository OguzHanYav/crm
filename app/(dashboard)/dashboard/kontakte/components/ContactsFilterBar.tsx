"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select, Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { ContactStatus } from "../types";

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5">
      <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
    </svg>
  );
}

type TabDef = {
  key: string;
  label: string;
  status?: ContactStatus;
  eventCategory?: "opening_call" | "follow_up_call";
};

const TABS: TabDef[] = [
  { key: "all", label: "Alle" },
  { key: "lead", label: "Leads", status: "Lead" },
  { key: "kunde", label: "Kunden", status: "Kunde" },
  { key: "followup", label: "Follow-Up", eventCategory: "follow_up_call" },
];

function getActiveTabKey(searchParams: URLSearchParams): string {
  const status = searchParams.get("status");
  const event = searchParams.get("event");
  if (event === "follow_up_call") return "followup";
  if (status === "Lead") return "lead";
  if (status === "Kunde") return "kunde";
  return "all";
}

export default function ContactsFilterBar({ companies }: { companies: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const activeTabKey = getActiveTabKey(searchParams);

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (searchParams.get("company")) count++;
    if (searchParams.get("from")) count++;
    if (searchParams.get("to")) count++;
    if (searchParams.get("dealStatus")) count++;
    return count;
  }, [searchParams]);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function selectTab(tab: TabDef) {
    updateParams({
      status: tab.status ?? null,
      event: tab.eventCategory ?? null,
    });
  }

  function resetAdvancedFilters() {
    updateParams({ company: null, from: null, to: null, dealStatus: null });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTabKey;
            return (
              <button
                key={tab.key}
                onClick={() => selectTab(tab)}
                className={`ring-focus rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {advancedFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetAdvancedFilters}>
              Filter zurücksetzen
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsOpen((v) => !v)}>
            <IconFilter />
            Filter
            {advancedFilterCount > 0 && (
              <Badge tone="accent" className="ml-0.5 h-4 min-w-4 justify-center px-1 text-[10px]">
                {advancedFilterCount}
              </Badge>
            )}
            <IconChevron open={isOpen} />
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Firma</Label>
            <Select
              value={searchParams.get("company") ?? ""}
              onChange={(e) => updateParams({ company: e.target.value || null })}
            >
              <option value="">Alle Firmen</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Zeitraum von</Label>
            <Input
              type="date"
              value={searchParams.get("from") ?? ""}
              onChange={(e) => updateParams({ from: e.target.value || null })}
            />
          </div>

          <div>
            <Label>Zeitraum bis</Label>
            <Input
              type="date"
              value={searchParams.get("to") ?? ""}
              onChange={(e) => updateParams({ to: e.target.value || null })}
            />
          </div>

          <div>
            <Label>Deal-Status</Label>
            <Select
              value={searchParams.get("dealStatus") ?? ""}
              onChange={(e) => updateParams({ dealStatus: e.target.value || null })}
            >
              <option value="">Alle</option>
              <option value="offen">Offen</option>
              <option value="gewonnen">Gewonnen</option>
              <option value="verloren">Verloren</option>
            </Select>
          </div>

          <div>
            <Label>Event-Kategorie</Label>
            <Select
              value={searchParams.get("event") ?? ""}
              onChange={(e) => updateParams({ event: e.target.value || null })}
            >
              <option value="">Alle</option>
              <option value="opening_call">Opening-Call</option>
              <option value="follow_up_call">Follow-Up</option>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
