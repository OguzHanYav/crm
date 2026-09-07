"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

type TabKey = "data" | "pipeline" | "profile" | "admin";
const TAB_KEYS: TabKey[] = ["data", "pipeline", "profile", "admin"];

const TABS: { key: TabKey; label: string }[] = [
  { key: "data", label: "Daten-Management" },
  { key: "pipeline", label: "Pipeline-Einstellungen" },
  { key: "profile", label: "Profil & Account" },
  { key: "admin", label: "🔒 Admin" },
];

export default function SettingsTabs({
  dataPanel,
  pipelinePanel,
  profilePanel,
  adminPanel,
}: {
  dataPanel: ReactNode;
  pipelinePanel: ReactNode;
  profilePanel: ReactNode;
  adminPanel: ReactNode;
}) {
  // Direct-Routing: /dashboard/settings?tab=pipeline öffnet den passenden Unter-Tab
  // sofort (z. B. vom "Pipeline-Einstellungen"-Button in der Pipeline-Ansicht aus).
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as TabKey | null;
  const [tab, setTab] = useState<TabKey>(initialTab && TAB_KEYS.includes(initialTab) ? initialTab : "data");

  const panels: Record<TabKey, ReactNode> = {
    data: dataPanel,
    pipeline: pipelinePanel,
    profile: profilePanel,
    admin: adminPanel,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1 w-fit flex-wrap">
        {TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`ring-focus rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div>{panels[tab]}</div>
    </div>
  );
}
