import { createClient } from "@/utils/supabase/server";
import type {
  Contact,
  ContactWithRelations,
  Note,
  CallLog,
  ContactDeal,
  TeamMember,
} from "./types";

export async function getContacts(searchQuery?: string): Promise<Contact[]> {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, status, notes, created_at")
    .order("created_at", { ascending: false });

  if (searchQuery && searchQuery.trim().length > 0) {
    const term = searchQuery.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("getContacts error:", error.message);
    return [];
  }

  return (data ?? []) as Contact[];
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

  return data as unknown as ContactWithRelations;
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
      id, contact_id, author_id, duration_minutes, summary, created_at,
      author:profiles!call_logs_author_id_fkey ( id, first_name, last_name )
      `
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getContactCallLogs error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as CallLog[];
}

export async function getContactDeals(contactId: string): Promise<ContactDeal[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      `
      id, title, value, currency, stage_id, pipeline_id,
      stage:deal_stages ( name, color_code ),
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

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("getTeamMembers error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getPipelines() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipelines")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("getPipelines error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getStagesByPipeline(pipelineId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_stages")
    .select("id, pipeline_id, name, position")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getStagesByPipeline error:", error.message);
    return [];
  }
  return data ?? [];
}
