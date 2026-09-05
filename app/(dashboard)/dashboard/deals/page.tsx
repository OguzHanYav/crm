import { getActiveProject } from "@/utils/projects/active-project";
import { getPipelineStages, getDealsByProject } from "./data";
import DealsView from "./components/DealsView";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";

export default async function DealsPage() {
  const activeProject = await getActiveProject();

  if (!activeProject) {
    return (
      <div className="p-8 text-center text-gray-500">
        Kein Projekt gefunden. Bitte zuerst ein Projekt in Supabase anlegen.
      </div>
    );
  }

  const [stages, deals] = await Promise.all([
    getPipelineStages(activeProject.id),
    getDealsByProject(activeProject.id),
  ]);

  if (stages.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Für &quot;{activeProject.name}&quot; sind keine sichtbaren Pipeline-Phasen konfiguriert.
      </div>
    );
  }

  return (
    <>
      <DealsView projectName={activeProject.name} stages={stages} deals={deals} />
      <ContactDetailSheet />
    </>
  );
}