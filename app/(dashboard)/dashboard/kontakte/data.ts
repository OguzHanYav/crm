import { createClient } from "@/utils/supabase/server";
import type {
  Contact,
  ContactWithRelations,
  Note,
  CallLog,
  ContactDeal,
  TeamMember,
  ContactSortKey,
  SortDir,
} from "./types";

export type ContactFilters = {
  q?: string;
  status?: string;
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  dealStatus?: string;
  eventCategory?: string;
};

// Lädt standardmäßig nur die ersten 100 Kontakte (Performance); "Mehr laden" ruft
// loadMoreContacts (actions.ts) mit einem höheren offset erneut auf.
export async function getContacts(
  filters?: ContactFilters | string,
  limit = 100,
  offset = 0,
  sortKey?: ContactSortKey,
  sortDir: SortDir = "asc"
): Promise<Contact[]> {
  const supabase = await createClient();
  const normalized: ContactFilters =
    typeof filters === "string" ? { q: filters } : filters ?? {};

  let query = supabase
    .from("contacts")
    .select(
      `
      id, first_name, last_name, email, phone, company, country, address, industry, status, notes, created_at,
      deals ( id, created_at, stage_id, stage:deal_stages!stage_id ( id, name, color ) )
      `
    );

  const ascending = sortDir === "asc";
  switch (sortKey) {
    case "name":
      query = query.order("first_name", { ascending }).order("last_name", { ascending });
      break;
    case "company":
      query = query.order("company", { ascending });
      break;
    case "country":
      query = query.order("country", { ascending });
      break;
    case "email":
      query = query.order("email", { ascending });
      break;
    case "phone":
      query = query.order("phone", { ascending });
      break;
    case "address":
      query = query.order("address", { ascending });
      break;
    case "industry":
      query = query.order("industry", { ascending });
      break;
    case "status":
      query = query.order("status", { ascending });
      break;
    case "createdAt":
      query = query.order("created_at", { ascending });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  // Sekundäres Sortierkriterium "id": Bulk-Importe teilen sich oft denselben
  // created_at-Zeitstempel — ohne stabilen Tiebreaker liefert range()-Pagination
  // instabile/duplizierte Zeilen an den Seitengrenzen.
  query = query.order("id", { ascending: true });

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

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error("getContacts error:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const deals = Array.isArray(row.deals) ? row.deals : row.deals ? [row.deals] : [];
    const latestDeal = [...deals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const stageRaw = latestDeal?.stage;
    const currentStage = stageRaw ? (Array.isArray(stageRaw) ? stageRaw[0] : stageRaw) : null;

    const { deals: _deals, ...contact } = row;
    return { ...contact, currentStage: currentStage ?? null };
  }) as Contact[];
}

// Gesamtzahl der zu den Filtern passenden Kontakte (für "Zeige X von Y Kontakten").
export async function getContactsTotalCount(filters?: ContactFilters | string): Promise<number> {
  const supabase = await createClient();
  const normalized: ContactFilters =
    typeof filters === "string" ? { q: filters } : filters ?? {};

  let query = supabase.from("contacts").select("id", { count: "exact", head: true });

  if (normalized.q && normalized.q.trim().length > 0) {
    const term = normalized.q.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
    );
  }
  if (normalized.status) query = query.eq("status", normalized.status);
  if (normalized.company && normalized.company.trim().length > 0) {
    query = query.ilike("company", `%${normalized.company.trim()}%`);
  }
  if (normalized.dateFrom) query = query.gte("created_at", normalized.dateFrom);
  if (normalized.dateTo) query = query.lte("created_at", `${normalized.dateTo}T23:59:59.999`);

  const { count, error } = await query;
  if (error) {
    console.error("getContactsTotalCount error:", error.message);
    return 0;
  }
  return count ?? 0;
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

  return (data ?? []).map((item: any) => {
    if (item.author && Array.isArray(item.author)) {
      item.author = item.author[0] || null;
    }
    return item;
  }) as unknown as Note[];
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

  return (data ?? []).map((item: any) => {
    if (item.author && Array.isArray(item.author)) {
      item.author = item.author[0] || null;
    }
    return item;
  }) as unknown as CallLog[];
}

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

  return (data ?? []).map((item: any) => {
    if (item.stage && Array.isArray(item.stage)) {
      item.stage = item.stage[0] || null;
    }
    if (item.pipeline && Array.isArray(item.pipeline)) {
      item.pipeline = item.pipeline[0] || null;
    }
    return item;
  }) as unknown as ContactDeal[];
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

export async function getStagesByPipeline(pipelineId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_stages")
    .select("id, pipeline_id, name, position, color")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getStagesByPipeline error:", error.message);
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
