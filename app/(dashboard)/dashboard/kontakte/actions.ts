"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Contact, ContactStatus, Note, CallLog, ContactFilters, DealStatusFilter, CallType } from "./types";

export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

const CONTACTS_PATH = "/dashboard/kontakte";

// ==================== HELPER ====================
function parseContactForm(formData: FormData) {
  return {
    first_name: (formData.get("first_name") as string)?.trim(),
    last_name: (formData.get("last_name") as string)?.trim(),
    email: (formData.get("email") as string)?.trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    company: (formData.get("company") as string)?.trim() || null,
    status: formData.get("status") as ContactStatus,
    notes: (formData.get("notes") as string)?.trim() || null,
    assigned_to: (formData.get("assigned_to") as string) || null,
  };
}

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

// ==================== DATA FETCHER ====================
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

export async function getTeamMembers() {
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

export async function getContactById(contactId: string) {
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

  return result;
}

export async function getContactNotes(contactId: string) {
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

  return (data ?? []).map((item: any) => {
    if (item.author && Array.isArray(item.author)) {
      item.author = item.author[0] || null;
    }
    return item;
  });
}

export async function getContactCallLogs(contactId: string) {
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

  return (data ?? []).map((item: any) => {
    if (item.author && Array.isArray(item.author)) {
      item.author = item.author[0] || null;
    }
    return item;
  });
}

export async function getContactDeals(contactId: string) {
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

  return (data ?? []).map((item: any) => {
    if (item.stage && Array.isArray(item.stage)) {
      item.stage = item.stage[0] || null;
    }
    if (item.pipeline && Array.isArray(item.pipeline)) {
      item.pipeline = item.pipeline[0] || null;
    }
    return item;
  });
}

export async function getPipelines() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipelines")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error) {
    console.error("getPipelines error:", error.message);
    return [];
  }
  return data ?? [];
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

  return (data ?? []).map((item: any) => {
    if (item.from_stage && Array.isArray(item.from_stage)) {
      item.from_stage = item.from_stage[0] || null;
    }
    if (item.to_stage && Array.isArray(item.to_stage)) {
      item.to_stage = item.to_stage[0] || null;
    }
    return item;
  });
}

// ==================== SERVER ACTIONS (CRUD) ====================
export async function createContact(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();
  const fields = parseContactForm(formData);

  if (!fields.first_name || !fields.last_name || !fields.email || !fields.status) {
    return {
      success: false,
      message: "Vorname, Nachname, E-Mail und Status sind erforderlich.",
    };
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert(fields)
    .select("id, first_name, last_name, email, phone, company, status, notes, created_at")
    .single();

  if (error) {
    console.error("createContact error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(CONTACTS_PATH);
  return { success: true, data: data as Contact };
}

export async function updateContact(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();
  const contactId = formData.get("contact_id") as string;
  const fields = parseContactForm(formData);

  if (!contactId) {
    return { success: false, message: "Kontakt-ID fehlt." };
  }
  if (!fields.first_name || !fields.last_name || !fields.email || !fields.status) {
    return {
      success: false,
      message: "Vorname, Nachname, E-Mail und Status sind erforderlich.",
    };
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(fields)
    .eq("id", contactId)
    .select("id, first_name, last_name, email, phone, company, status, notes, created_at")
    .single();

  if (error) {
    console.error("updateContact error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(CONTACTS_PATH);
  return { success: true, data: data as Contact };
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      success: false,
      message: "Keine Berechtigung: Nur Admins dürfen Kontakte löschen.",
    };
  }

  const { error } = await supabase.from("contacts").delete().eq("id", contactId);

  if (error) {
    console.error("deleteContact error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(CONTACTS_PATH);
  return { success: true };
}

export async function addNoteToContact(
  contactId: string,
  noteText: string
): Promise<ActionResult<Note>> {
  const supabase = await createClient();

  const trimmed = noteText.trim();
  if (!trimmed) {
    return { success: false, message: "Notiz darf nicht leer sein." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("notes")
    .insert({
      contact_id: contactId,
      author_id: user?.id ?? null,
      content: trimmed,
    })
    .select(
      `id, contact_id, author_id, content, created_at, author:profiles!notes_author_id_fkey ( id, first_name, last_name )`
    )
    .single();

  if (error) {
    console.error("addNoteToContact error:", error.message);
    return { success: false, message: error.message };
  }

  const result = data as any;
  if (result.author && Array.isArray(result.author)) {
    result.author = result.author[0] || null;
  }

  await supabase
    .from("contacts")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", contactId);

  revalidatePath(`/dashboard/kontakte/${contactId}`);
  return { success: true, data: result as Note };
}

export async function logCall(
  contactId: string,
  formData: FormData
): Promise<ActionResult<CallLog>> {
  const supabase = await createClient();

  const summary = (formData.get("summary") as string)?.trim();
  const call_type = (formData.get("call_type") as string) || "opening_call";
  const interest_raw = formData.get("interest_expressed") as string;
  const interest_expressed = interest_raw === "" ? null : interest_raw === "true";
  const called_at_raw = formData.get("called_at") as string;
  const called_at = called_at_raw ? new Date(called_at_raw).toISOString() : new Date().toISOString();

  if (!summary) {
    return { success: false, message: "Bitte eine Zusammenfassung angeben." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("call_logs")
    .insert({
      contact_id: contactId,
      user_id: user?.id ?? null,
      call_type,
      interest_expressed,
      called_at,
      notes: summary,
    })
    .select(
      `id, contact_id, user_id, call_type, interest_expressed, called_at, notes, created_at, author:profiles!call_logs_user_id_fkey ( first_name, last_name )`
    )
    .single();

  if (error) {
    console.error("logCall error:", error.message);
    return { success: false, message: error.message };
  }

  const result = data as any;
  if (result.author && Array.isArray(result.author)) {
    result.author = result.author[0] || null;
  }

  await supabase
    .from("contacts")
    .update({ last_contacted_at: called_at })
    .eq("id", contactId);

  revalidatePath("/dashboard/kontakte");
  revalidatePath("/dashboard/deals");
  return { success: true, data: result as CallLog };
}

export async function updateContactDetails(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();
  const contactId = formData.get("contact_id") as string;

  if (!contactId) {
    return { success: false, message: "Kontakt-ID fehlt." };
  }

  const fields = {
    first_name: (formData.get("first_name") as string)?.trim(),
    last_name: (formData.get("last_name") as string)?.trim(),
    email: (formData.get("email") as string)?.trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    company: (formData.get("company") as string)?.trim() || null,
    position: (formData.get("position") as string)?.trim() || null,
    address: (formData.get("address") as string)?.trim() || null,
    country: (formData.get("country") as string)?.trim() || null,
    status: formData.get("status") as Contact["status"],
    assigned_to: (formData.get("assigned_to") as string) || null,
  };

  if (!fields.first_name || !fields.last_name || !fields.email || !fields.status) {
    return {
      success: false,
      message: "Vorname, Nachname, E-Mail und Status sind erforderlich.",
    };
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(fields)
    .eq("id", contactId)
    .select("*")
    .single();

  if (error) {
    console.error("updateContactDetails error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(`/dashboard/kontakte/${contactId}`);
  revalidatePath("/dashboard/kontakte");
  return { success: true, data: data as unknown as Contact };
}

// ==================== SHEET DATA FETCHER ====================
export async function getContactDetailPayload(contactId: string) {
  const supabase = await createClient();

  const contactResult = await getContactById(contactId);
  if (!contactResult) {
    return { success: false, message: "Kontakt nicht gefunden." };
  }

  const [notes, callLogs, deals, stageHistory] = await Promise.all([
    getContactNotes(contactId),
    getContactCallLogs(contactId),
    getContactDeals(contactId),
    getContactStageHistory(contactId),
  ]);

  return {
    success: true,
    data: { contact: contactResult, notes, callLogs, deals, stageHistory },
  };
}

export async function getContactSheetBootstrap() {
  const [teamMembers, pipelines, stages] = await Promise.all([
    getTeamMembers(),
    getPipelines(),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("deal_stages")
        .select("id, pipeline_id, name, position, color")
        .order("position", { ascending: true });

      if (error) {
        console.error("getAllStages error:", error.message);
        return [];
      }
      return data ?? [];
    })(),
  ]);

  return { success: true, data: { teamMembers, pipelines, stages } };
}
