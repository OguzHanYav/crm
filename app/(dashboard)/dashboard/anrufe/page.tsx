import { requireFeature } from "@/lib/features";

export default async function AnrufePage() {
  // Paket ohne Telefonie -> "Upgrade erforderlich"; Mitglied ohne Freigabe -> "Keine Berechtigung".
  await requireFeature("calls");

  return (
    <div className="p-0 sm:p-6">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Anrufe</h1>
      <p className="text-muted-foreground">Hier entsteht in Tag 5 das Call-Protokoll.</p>
    </div>
  );
}
