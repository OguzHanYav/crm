import DataManagementSettings from "./components/DataManagementSettings";
import PipelineStagesSettings from "./components/PipelineStagesSettings";
import ProfileSettings from "./components/ProfileSettings";
import SettingsTabs from "./components/SettingsTabs";
import { getPipelineStagesForSettings } from "./pipeline-actions";
import { getCurrentProfile } from "./profile-data";

export default async function SettingsPage() {
  const [stages, profile] = await Promise.all([
    getPipelineStagesForSettings(),
    getCurrentProfile(),
  ]);

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
      />
    </div>
  );
}
