import { redirect } from "next/navigation";
import { currentUserIsAdmin, getFeatureFlags, MEMBER_FEATURES, type FeatureKey } from "@/lib/features";
import { getAdminOrFallbackClient } from "@/lib/supabase/admin";
import { getTeamMembersForAdmin, memberDisplayName } from "@/lib/team";
import FeatureFlagsSettings from "../settings/components/FeatureFlagsSettings";
import MemberFeaturesManager, { type MemberFeatureRow } from "./components/MemberFeaturesManager";

// Feature-Freigaben pro Mitglied — nur für Admins.
export default async function FeaturesPage() {
  if (!(await currentUserIsAdmin())) redirect("/dashboard");

  const client = await getAdminOrFallbackClient();
  const [members, globalFlags, { data: overrides, error }] = await Promise.all([
    getTeamMembersForAdmin(),
    getFeatureFlags(),
    client.from("user_feature_flags").select("user_id, feature_key, enabled"),
  ]);
  if (error) console.error("FeaturesPage user_feature_flags error:", error.message);

  const features = (Object.keys(MEMBER_FEATURES) as FeatureKey[]).map((key) => ({
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
