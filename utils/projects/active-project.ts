import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const ACTIVE_PROJECT_COOKIE = "active_project_id";

export type ProjectOption = { id: string; name: string };

export async function getProjects(): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("getProjects error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getActiveProject(): Promise<ProjectOption | null> {
  const [projects, cookieStore] = await Promise.all([getProjects(), cookies()]);
  if (projects.length === 0) return null;

  const cookieValue = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;
  const fromCookie = cookieValue ? projects.find((p) => p.id === cookieValue) : undefined;

  return fromCookie ?? projects[0];
}

export async function getActiveProjectId(): Promise<string | null> {
  const project = await getActiveProject();
  return project?.id ?? null;
}
