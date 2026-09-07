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
      <div className="no-scrollbar w-full overflow-x-auto sm:w-fit">
        <div className="flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-xl bg-muted/50 p-1">
          {TABS.map((t) => {
            const isActive = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`ring-focus min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>{panels[tab]}</div>
    </div>
  );
}
