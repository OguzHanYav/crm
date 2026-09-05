import { createClient } from "@/utils/supabase/server";
import {
  getPipelines,
  getStagesByPipeline,
  getAllStages,
  getTeamMembers,
} from "../deals/data";
import type {
  Contact,
  ContactWithRelations,
  Note,
  CallLog,
  ContactDeal,
  ContactFilters,
  DealStatusFilter,
  CallType,
} from "./types";

// Referenzdaten (Pipelines, Stages, Team-Mitglieder) kommen aus einer
// gemeinsamen, React.cache-deduplizierten Quelle. Dadurch wird z.B. beim
// Öffnen des Kontakt-Sheets (das intern Pipelines/Stages/Team braucht)
// keine zusätzliche DB-Anfrage ausgelöst, wenn dieselben Daten im selben
// Request bereits vom Deals-Tab geladen wurden.
export { getPipelines, getStagesByPipeline, getAllStages, getTeamMembers };

async function getContactIdsByDealStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealStatus: DealStatusFilter
): Promise<string[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("contact_id, stage:deal_stages!deals_stage_id_fkey ( name )");

  if (error || !data) {
    console.error("getContactIdsByDealStatus error:", error?.message);
    return [];
  }

  const filtered = data.filter((row: any) => {
    const stageRaw = Array.isArray(row.stage) ? row.stage[0] : row.stage;
    const stageName = (stageRaw?.name ?? "").toLowerCase();
    const isWon = stageName.includes("gewonnen") || stageName.includes("won");
    const isLost = stageName.includes("verloren") || stageName.includes("lost");
    if (dealStatus === "gewonnen") return isWon;
    if (dealStatus === "verloren") return isLost;
    return !isWon && !isLost;
  });

  return [...new Set(filtered.map((row: any) => row.contact_id).filter(Boolean))];
}

async function getContactIdsByEventCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventCategory: CallType
): Promise<string[]> {
  const { data, error } = await supabase
    .from("call_logs")
    .select("contact_id")
    .eq("call_type", eventCategory);

  if (error || !data) {
    console.error("getContactIdsByEventCategory error:", error?.message);
    return [];
  }

  return [...new Set(data.map((row: any) => row.contact_id).filter(Boolean))];
}

// Dynamische, gefilterte Liste -> bewusst UNGECACHED (Filter ändern sich pro
// Aufruf). Select bleibt schlank, Sortierung passend zum created_at-Index.
export async function getContacts(filters?: ContactFilters | string): Promise<Contact[]> {
  const supabase = await createClient();

  const normalized: ContactFilters =
    typeof filters === "string" ? { q: filters } : filters ?? {};

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, status, notes, created_at")
    .order("created_at", { ascending: false });

  if (normalized.q && normalized.q.trim().length > 0) {
    const term = normalized.q.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
    );
  }

  if (normalized.status) {
    query = query.eq("status", normalized.status);
  }

  if (normalized.company && normalized.company.trim().length > 0) {
    query = query.ilike("company", `%${normalized.company.trim()}%`);
  }

  if (normalized.dateFrom) {
    query = query.gte("created_at", normalized.dateFrom);
  }

  if (normalized.dateTo) {
    query = query.lte("created_at", `${normalized.dateTo}T23:59:59.999`);
  }

  if (normalized.dealStatus) {
    const ids = await getContactIdsByDealStatus(supabase, normalized.dealStatus);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  if (normalized.eventCategory) {
    const ids = await getContactIdsByEventCategory(supabase, normalized.eventCategory);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getContacts error:", error.message);
    return [];
  }

  return (data ?? []) as Contact[];
}

export async function getContactCompanies(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("company")
    .not("company", "is", null)
    .order("company", { ascending: true });

  if (error || !data) {
    console.error("getContactCompanies error:", error?.message);
    return [];
  }

  return [...new Set(data.map((row: any) => row.company).filter(Boolean))];
}

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("getCurrentUserRole error:", error.message);
    return null;
  }

  return profile?.role ?? null;
}

// Kontakt inkl. Sales-Rep in EINER Join-Abfrage.
export async function getContactById(
  contactId: string
): Promise<ContactWithRelations | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
      id, first_name, last_name, email, phone, company, position, address, country,
      status, notes, assigned_to, last_contacted_at, created_at,
      assigned_profile:profiles!contacts_assigned_to_fkey ( id, first_name, last_name )
      `
    )
    .eq("id", contactId)
    .single();

  if (error) {
    console.error("getContactById error:", error.message);
    return null;
  }

  const result = data as any;
  if (result.assigned_profile && Array.isArray(result.assigned_profile)) {
    result.assigned_profile = result.assigned_profile[0] || null;
  }

  return result as unknown as ContactWithRelations;
}

export async function getContactNotes(contactId: string): Promise<Note[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .select(
      `
      id, contact_id, author_id, content, created_at,
      author:profiles!notes_author_id_fkey ( id, first_name, last_name )
      `
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getContactNotes error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Note[];
}

export async function getContactCallLogs(contactId: string): Promise<CallLog[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("call_logs")
    .select(
      `
      id, contact_id, user_id, call_type, interest_expressed, called_at, notes, created_at,
      author:profiles!call_logs_user_id_fkey ( id, first_name, last_name )
      `
    )
    .eq("contact_id", contactId)
    .order("called_at", { ascending: false });

  if (error) {
    console.error("getContactCallLogs error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as CallLog[];
}

// Deals inkl. Stage + Pipeline in EINER Join-Abfrage (kein Waterfall),
// sortiert nach created_at (Index deals.created_at).
export async function getContactDeals(contactId: string): Promise<ContactDeal[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      `
      id, name, value, stage_id, pipeline_id,
      stage:deal_stages!deals_stage_id_fkey ( name, color ),
      pipeline:pipelines ( name )
      `
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getContactDeals error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ContactDeal[];
}

export async function getContactStageHistory(contactId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_stage_history")
    .select(
      `
      id, deal_id, from_stage_id, to_stage_id, changed_at,
      from_stage:deal_stages!deal_stage_history_from_stage_id_fkey ( name ),
      to_stage:deal_stages!deal_stage_history_to_stage_id_fkey ( name ),
      deals!inner ( contact_id )
      `
    )
    .eq("deals.contact_id", contactId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("getContactStageHistory error:", error.message);
    return [];
  }

  return data ?? [];
}
