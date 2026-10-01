import { redirect } from "next/navigation";
import DataManagementSettings from "./components/DataManagementSettings";
import PipelineStagesSettings from "./components/PipelineStagesSettings";
import ProfileSettings from "./components/ProfileSettings";
import AdminPanel from "./components/AdminPanel";
import SettingsTabs from "./components/SettingsTabs";
import FeatureFlagsSettings from "./components/FeatureFlagsSettings";
import EmailSettingsForm from "@/components/settings/EmailSettingsForm";
import { currentTenantId } from "@/lib/tenant";
import { getFeatureFlags, MEMBER_FEATURES, type FeatureKey } from "@/lib/features";
import { getPipelineStagesForSettings } from "./pipeline-actions";
import { getCurrentProfile } from "./profile-data";
import { isCurrentUserAdmin, getCurrentUserRole } from "./admin-actions";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";

export default async function SettingsPage() {
  const [stages, profile, userRole, featureFlags] = await Promise.all([
    getPipelineStagesForSettings(),
    getCurrentProfile(),
    getCurrentUserRole(),
    getFeatureFlags(),
  ]);
  const featureList = (Object.keys(MEMBER_FEATURES) as FeatureKey[]).map((key) => ({
    key,
    label: MEMBER_FEATURES[key].label,
    description: MEMBER_FEATURES[key].description,
  }));

  const isAdmin = isAdminRole(userRole);
  // Feature-Freigaben/Pakete verwaltet ausschließlich der Plattform-Inhaber.
  const isSuperAdmin = isSuperAdminRole(userRole);
  const tenantId = await currentTenantId();

  return (
    <div className="flex min-w-0 flex-col gap-4 p-0 max-sm:pb-16 sm:gap-6 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verwalte Daten, Pipeline-Phasen und deinen Account.
        </p>
      </div>

      <SettingsTabs
        dataPanel={<DataManagementSettings />}
        pipelinePanel={<PipelineStagesSettings initialStages={stages} />}
        profilePanel={<ProfileSettings profile={profile} />}
        adminPanel={
          isAdmin ? (
            <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
              {isSuperAdmin ? (
                <FeatureFlagsSettings features={featureList} initialFlags={featureFlags} />
              ) : (
                <section className="rounded-lg border border-border bg-muted/30 p-5 max-sm:p-3">
                  <h2 className="text-base font-semibold text-foreground">Feature-Freigaben</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Feature-Freigaben und Paket-Erweiterungen werden zentral durch den Plattform-Inhaber verwaltet.
                  </p>
                </section>
              )}
              {tenantId && <EmailSettingsForm tenantId={tenantId} />}
              <AdminPanel />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              🔒 Diese Seite ist nur für Administratoren zugänglich.
            </div>
          )
        }
      />
    </div>
  );
}
