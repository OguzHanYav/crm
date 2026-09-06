import DataManagementSettings from "./components/DataManagementSettings";
import PipelineStagesSettings from "./components/PipelineStagesSettings";
import ProfileSettings from "./components/ProfileSettings";
import AdminPanel from "./components/AdminPanel";
import SettingsTabs from "./components/SettingsTabs";
import { getPipelineStagesForSettings } from "./pipeline-actions";
import { getCurrentProfile } from "./profile-data";
import { getCurrentUserRole } from "./admin-actions";

export default async function SettingsPage() {
  const [stages, profile, userRole] = await Promise.all([
    getPipelineStagesForSettings(),
    getCurrentProfile(),
    getCurrentUserRole(),
  ]);

  const isAdmin = userRole === "admin";

  return (
    <div className="flex flex-col gap-6 p-6">
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
        adminPanel={isAdmin ? <AdminPanel /> : <div className="text-muted-foreground text-sm">Kein Zugriff: Nur Administratoren können diese Seite sehen.</div>}
      />
    </div>
  );
}
