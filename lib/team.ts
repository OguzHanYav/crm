import { getAdminOrFallbackClient } from "@/lib/supabase/admin";

export type TeamMemberRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "employee" | string;
};

export function memberDisplayName(m: Pick<TeamMemberRow, "first_name" | "last_name" | "email">): string {
  return [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Unbenannt";
}

// Alle Team-Mitglieder für Admin-Seiten. Aufrufer MUSS vorher die Admin-Rolle prüfen.
export async function getTeamMembersForAdmin(): Promise<TeamMemberRow[]> {
  const client = await getAdminOrFallbackClient();
  const { data, error } = await client
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .order("first_name", { ascending: true });
  if (error) {
    console.error("getTeamMembersForAdmin error:", error.message);
    return [];
  }
  return (data ?? []) as TeamMemberRow[];
}
