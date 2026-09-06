// Dummy-Modul: Projekt-Konzept wurde entfernt.
// Bleibt bestehen, damit alte Imports im Code nicht crashen.

export async function getActiveProjectId(): Promise<string | null> {
  return null;
}

export async function getActiveProject(): Promise<{ id: string; name: string } | null> {
  return null;
}

export async function getProjects(): Promise<Array<{ id: string; name: string }>> {
  return [];
}

export const ACTIVE_PROJECT_COOKIE = "active_project_id";
export type ProjectOption = { id: string; name: string };
