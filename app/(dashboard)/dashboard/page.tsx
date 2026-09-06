import { getDashboardStats } from "./data";

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const kpis = [
    { label: "Kontakte gesamt", value: stats.totalContacts },
    { label: "Deals gesamt", value: stats.totalDeals },
    { label: "Offene Deals", value: stats.openDeals },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Überblick über Kontakte, Pipeline und Aktivitäten.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="text-sm text-muted-foreground">{kpi.label}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-foreground">Deals nach Phase</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {stats.dealsByStage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Phasen angelegt.</p>
            ) : (
              stats.dealsByStage.map((stage) => (
                <li key={stage.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </span>
                  <span className="font-medium text-foreground">{stage.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-foreground">Neueste Aktivitäten</h2>
          {stats.activities.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Noch keine Aktivitäten.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {stats.activities.map((activity, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span>{activity.type === "note" ? "📝" : "📞"}</span>
                  <div>
                    <p className="text-foreground">{activity.text}</p>
                    <p className="text-xs text-muted-foreground">{formatDateDE(activity.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
