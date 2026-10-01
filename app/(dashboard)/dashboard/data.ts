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

// ==================== ERWEITERTES DASHBOARD ====================
// Zusätzliche, rein lesende Abfragen für die Dashboard-Widgets. Die obigen
// Kennzahlen (getDashboardStats) bleiben unverändert.

// Dashboard zeigt "heute" in deutscher Zeit, auch wenn der Server in UTC läuft.
export const DASHBOARD_TIME_ZONE = "Europe/Berlin";

function startOfTodayIso(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  // Offset der Zeitzone zum aktuellen Zeitpunkt ermitteln (Sommer-/Winterzeit).
  const tzName = new Intl.DateTimeFormat("en-US", { timeZone: DASHBOARD_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value; // z. B. "GMT+02:00"
  const offset = tzName?.replace("GMT", "") || "+00:00";
  return new Date(`${parts}T00:00:00${offset === "" ? "+00:00" : offset}`).toISOString();
}

export type RecentCall = {
  id: string;
  contactName: string;
  callType: "opening_call" | "follow_up_call";
  interestExpressed: boolean | null;
  calledAt: string;
  authorName: string | null;
};

export type StreamEntry = {
  id: string;
  kind: "contact_created" | "note" | "call" | "email" | "whatsapp" | "stage_change";
  date: string;
  text: string;
  failed?: boolean;
};

export async function getCallsTodayCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .gte("called_at", startOfTodayIso());
  if (error) {
    console.error("getCallsTodayCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getRecentCalls(limit = 5): Promise<RecentCall[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_logs")
    .select(
      "id, call_type, interest_expressed, called_at, contact:contacts ( first_name, last_name ), author:profiles!call_logs_user_id_fkey ( first_name, last_name )"
    )
    .order("called_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRecentCalls error:", error.message);
    return [];
  }
  return (data ?? []).map((c: any) => {
    const author = Array.isArray(c.author) ? c.author[0] : c.author;
    return {
      id: c.id,
      contactName: contactName(c.contact),
      callType: c.call_type,
      interestExpressed: c.interest_expressed,
      calledAt: c.called_at,
      authorName: author ? `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim() || null : null,
    };
  });
}

// Summe aller erfolgreich zugestellten Nachrichten über alle Versand-Jobs.
export async function getSentNotificationsCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notification_jobs").select("sent_items");
  if (error) {
    console.error("getSentNotificationsCount error:", error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, j: any) => sum + (j.sent_items ?? 0), 0);
}

// Chronologischer Aktivitäts-Stream aus mehreren Quellen. Versand-Aktivitäten
// (E-Mail/WhatsApp) nur, wenn der Nutzer das Benachrichtigungs-Feature hat.
export async function getActivityStream({
  includeMessages,
  limit = 10,
}: {
  includeMessages: boolean;
  limit?: number;
}): Promise<StreamEntry[]> {
  const supabase = await createClient();
  const per = limit;

  const [contacts, notes, calls, messages, stageChanges] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name, created_at").order("created_at", { ascending: false }).limit(per),
    supabase
      .from("notes")
      .select("id, content, created_at, contact:contacts ( first_name, last_name )")
      .order("created_at", { ascending: false })
      .limit(per),
    supabase
      .from("call_logs")
      .select("id, call_type, called_at, contact:contacts ( first_name, last_name )")
      .order("called_at", { ascending: false })
      .limit(per),
    includeMessages
      ? supabase.from("activities").select("id, type, description, created_at").order("created_at", { ascending: false }).limit(per)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from("deal_stage_history")
      .select(
        "id, changed_at, to_stage:deal_stages!deal_stage_history_to_stage_id_fkey ( name ), deal:deals ( name )"
      )
      .order("changed_at", { ascending: false })
      .limit(per),
  ]);

  for (const [name, res] of Object.entries({ contacts, notes, calls, messages, stageChanges })) {
    if (res.error) console.error(`getActivityStream ${name} error:`, res.error.message);
  }

  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const entries: StreamEntry[] = [
    ...(contacts.data ?? []).map((c: any) => ({
      id: `contact-${c.id}`,
      kind: "contact_created" as const,
      date: c.created_at,
      text: `Kontakt ${`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "ohne Namen"} angelegt`,
    })),
    ...(notes.data ?? []).map((n: any) => ({
      id: `note-${n.id}`,
      kind: "note" as const,
      date: n.created_at,
      text: `Notiz zu ${contactName(n.contact)}: ${n.content}`,
    })),
    ...(calls.data ?? []).map((c: any) => ({
      id: `call-${c.id}`,
      kind: "call" as const,
      date: c.called_at,
      text: `${c.call_type === "opening_call" ? "Opening-Call" : "Follow-up-Call"} mit ${contactName(c.contact)}`,
    })),
    ...(messages.data ?? []).map((a: any) => ({
      id: `activity-${a.id}`,
      kind: (String(a.type).startsWith("whatsapp") ? "whatsapp" : "email") as "email" | "whatsapp",
      date: a.created_at,
      text: a.description,
      failed: String(a.type).endsWith("_failed"),
    })),
    ...(stageChanges.data ?? []).map((h: any) => ({
      id: `stage-${h.id}`,
      kind: "stage_change" as const,
      date: h.changed_at,
      text: `${one(h.deal)?.name ?? "Deal"} → Phase „${one(h.to_stage)?.name ?? "?"}“`,
    })),
  ];

  return entries
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export async function getAssignedPhoneNumber(userId: string): Promise<{ number: string; label: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("phone_numbers")
    .select("number, label")
    .eq("assigned_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Tabelle evtl. noch nicht angelegt — Widget zeigt dann "keine Nummer".
    return null;
  }
  return data ?? null;
}
