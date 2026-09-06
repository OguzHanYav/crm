import { createClient } from "@/utils/supabase/server";

export type StageSummary = {
  id: string;
  name: string;
  color: string;
  count: number;
};

export type DashboardActivity = {
  type: "note" | "call";
  date: string;
  text: string;
};

export type DashboardStats = {
  totalContacts: number;
  totalDeals: number;
  openDeals: number;
  dealsByStage: StageSummary[];
  activities: DashboardActivity[];
};

function contactName(contact: any): string {
  const c = Array.isArray(contact) ? contact[0] : contact;
  if (!c) return "Unbekannt";
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unbekannt";
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [
    { count: totalContacts },
    { data: stages },
    { data: deals },
    { data: recentNotes },
    { data: recentCalls },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("deal_stages").select("id, name, color, position").order("position", { ascending: true }),
    supabase.from("deals").select("id, stage_id"),
    supabase
      .from("notes")
      .select("id, content, created_at, contact:contacts ( first_name, last_name )")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("call_logs")
      .select("id, call_type, notes, called_at, created_at, contact:contacts ( first_name, last_name )")
      .order("called_at", { ascending: false })
      .limit(5),
  ]);

  const dealsByStage: StageSummary[] = (stages ?? []).map((stage) => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    count: (deals ?? []).filter((d) => d.stage_id === stage.id).length,
  }));

  const openDeals = dealsByStage
    .filter((s) => {
      const name = s.name.toLowerCase();
      return !name.includes("gewonnen") && !name.includes("verloren");
    })
    .reduce((sum, s) => sum + s.count, 0);

  const activities: DashboardActivity[] = [
    ...(recentNotes ?? []).map((n) => ({
      type: "note" as const,
      date: n.created_at,
      text: `Notiz zu ${contactName(n.contact)}: ${n.content}`,
    })),
    ...(recentCalls ?? []).map((c) => ({
      type: "call" as const,
      date: c.called_at || c.created_at,
      text: `${c.call_type === "opening_call" ? "Opening-Call" : "Follow-Up"} mit ${contactName(c.contact)}${c.notes ? `: ${c.notes}` : ""}`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return {
    totalContacts: totalContacts ?? 0,
    totalDeals: (deals ?? []).length,
    openDeals,
    dealsByStage,
    activities,
  };
}
