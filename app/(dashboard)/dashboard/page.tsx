import { getDashboardStats } from "./data";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const kpis = [
    { label: "Kontakte gesamt", value: stats.totalContacts },
    { label: "Deals gesamt", value: stats.totalDeals },
    { label: "Offene Deals", value: stats.openDeals },
  ];

  const maxStageCount = Math.max(1, ...stats.dealsByStage.map((s) => s.count));

  return (
    <div className="flex flex-col gap-5 max-sm:pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Überblick über Kontakte und Pipeline.</p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-card p-3 shadow-soft sm:p-4">
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{kpi.value}</div>
          </div>
        ))}

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-soft sm:col-span-3 sm:p-4">
          <h2 className="text-sm font-semibold text-foreground">Deals nach Phase</h2>
          {stats.dealsByStage.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Noch keine Phasen angelegt.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {stats.dealsByStage.map((stage) => (
                <li key={stage.id} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 truncate text-foreground sm:w-28">{stage.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(stage.count / maxStageCount) * 100}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right font-medium text-foreground">{stage.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
