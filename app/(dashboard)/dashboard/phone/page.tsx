import { redirect } from "next/navigation";
import { currentUserIsAdmin } from "@/lib/features";
import { getAdminOrFallbackClient } from "@/lib/supabase/admin";
import { getTeamMembersForAdmin, memberDisplayName } from "@/lib/team";
import { isSipConfigured } from "@/lib/sip/server-config";
import { currentTenantId, scopeToTenant } from "@/lib/tenant";
import PhoneStatusCard from "./components/PhoneStatusCard";
import PhoneNumbersManager from "./components/PhoneNumbersManager";
import type { PhoneNumber } from "./types";

// Telefonie-Verwaltung — nur für Admins (Navigation blendet den Punkt für
// Mitglieder aus, dieser Guard schützt zusätzlich den Direktaufruf).
export default async function PhonePage() {
  if (!(await currentUserIsAdmin())) redirect("/dashboard");

  const client = await getAdminOrFallbackClient();
  const [{ data: numbers, error }, members] = await Promise.all([
    scopeToTenant(
      client.from("phone_numbers").select("*"),
      await currentTenantId()
    ).order("created_at", { ascending: true }),
    getTeamMembersForAdmin(),
  ]);

  if (error) console.error("PhonePage phone_numbers error:", error.message);

  return (
    <div className="flex min-w-0 flex-col gap-4 max-sm:pb-16 sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Telefon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rufnummern und Telefone verwalten, Mitarbeitern zuweisen und den Verbindungsstatus prüfen.
        </p>
      </div>

      <PhoneStatusCard sipConfigured={isSipConfigured()} />

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Rufnummern konnten nicht geladen werden. Ist die Tabelle <code>phone_numbers</code> angelegt?
        </div>
      ) : (
        <PhoneNumbersManager
          initialNumbers={(numbers ?? []) as PhoneNumber[]}
          members={members.map((m) => ({ id: m.id, name: memberDisplayName(m), role: m.role }))}
        />
      )}
    </div>
  );
}
