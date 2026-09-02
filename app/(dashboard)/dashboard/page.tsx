export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Willkommen zurück. Hier entsteht ab Tag 3 die Pipeline-Übersicht.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {['Offene Deals', 'Termine diese Woche', 'Abschlüsse (Monat)'].map(
          (label) => (
            <div
              key={label}
              className="rounded-md border border-line bg-surface p-5"
            >
              <div className="text-sm text-muted">{label}</div>
              <div className="tabular mt-2 text-2xl font-semibold text-ink">
                —
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
