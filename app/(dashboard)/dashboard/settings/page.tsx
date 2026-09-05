import DataManagementSettings from "./components/DataManagementSettings";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Einstellungen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Verwalte Import und Export deiner Kunden- und Deal-Daten.
        </p>
      </div>

      <DataManagementSettings />
    </div>
  );
}
