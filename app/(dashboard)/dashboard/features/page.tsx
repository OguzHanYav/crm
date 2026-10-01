import { redirect } from "next/navigation";
import { currentUserIsAdmin, getFeatureFlags, MEMBER_FEATURES, type FeatureKey } from "@/lib/features";
import { getAdminOrFallbackClient } from "@/lib/supabase/admin";
import { getTeamMembersForAdmin, memberDisplayName } from "@/lib/team";
import { getCurrentTenant, PLAN_LABELS, TENANT_FEATURE_LABELS, type TenantFeatureKey } from "@/lib/tenant";
import FeatureFlagsSettings from "../settings/components/FeatureFlagsSettings";
import MemberFeaturesManager, { type MemberFeatureRow } from "./components/MemberFeaturesManager";

// Feature-Freigaben pro Mitglied — nur für Admins.
export default async function FeaturesPage() {
  if (!(await currentUserIsAdmin())) redirect("/dashboard");

  const client = await getAdminOrFallbackClient();
  // Mitglieder sind bereits auf den eigenen Mandanten gefiltert (lib/team.ts);
  // Freigaben daher nur für diese Nutzer laden.
  const [members, globalFlags] = await Promise.all([getTeamMembersForAdmin(), getFeatureFlags()]);
  const memberIds = members.map((m) => m.id);
  const { data: overrides, error } = memberIds.length
    ? await client.from("user_feature_flags").select("user_id, feature_key, enabled").in("user_id", memberIds)
    : { data: [], error: null };
  if (error) console.error("FeaturesPage user_feature_flags error:", error.message);

  const tenant = await getCurrentTenant();
  // Nur Features, die im Paket enthalten sind, lassen sich an Mitglieder vergeben.
  const features = (Object.keys(MEMBER_FEATURES) as FeatureKey[]).filter((key) => tenant.features[key]).map((key) => ({
    key,
    label: MEMBER_FEATURES[key].label,
    description: MEMBER_FEATURES[key].description,
  }));

  const rows: MemberFeatureRow[] = members.map((m) => {
    const own: Partial<Record<FeatureKey, boolean>> = {};
    for (const o of overrides ?? []) {
      if (o.user_id === m.id && o.feature_key in MEMBER_FEATURES) own[o.feature_key as FeatureKey] = Boolean(o.enabled);
    }
    return { id: m.id, name: memberDisplayName(m), email: m.email, isAdmin: m.role === "admin", overrides: own };
  });

  return (
    <div className="flex min-w-0 flex-col gap-4 max-sm:pb-16 sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Features</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Funktionen für einzelne Mitglieder freischalten oder sperren. Administratoren haben immer Zugriff auf alles.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Paket deiner Organisation</h2>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            {PLAN_LABELS[tenant.plan]}
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {(Object.keys(TENANT_FEATURE_LABELS) as TenantFeatureKey[]).map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className={tenant.features[key] ? "text-success" : "text-muted-foreground"}>
                {tenant.features[key] ? "✓" : "–"}
              </span>
              <span className={tenant.features[key] ? "text-foreground" : "text-muted-foreground"}>
                {TENANT_FEATURE_LABELS[key]}
                {!tenant.features[key] && " (Upgrade erforderlich)"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Freigaben konnten nicht geladen werden. Ist die Tabelle <code>user_feature_flags</code> angelegt?
        </div>
      ) : (
        <MemberFeaturesManager features={features} globalFlags={globalFlags} initialRows={rows} />
      )}

      <FeatureFlagsSettings features={features} initialFlags={globalFlags} />
    </div>
  );
}
