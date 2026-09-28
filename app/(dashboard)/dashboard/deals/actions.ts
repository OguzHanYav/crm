"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getActiveProjectId } from "@/utils/projects/active-project";
import type { Deal, DealSortKey, SortDir } from "./types";
import { countryIlikePatterns } from "@/lib/i18n/multilingual";

export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

const DEAL_SELECT = `
  id, name, pipeline_id, stage_id, contact_id, assigned_to, value, created_at,
  contact:contacts ( id, first_name, last_name, email, phone ),
  assigned_profile:profiles!deals_assigned_to_fkey ( id, first_name, last_name, role )
`;

type ContactStatusLike = "Lead" | "In Kontakt" | "Kunde" | "Verloren";
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function statusFromStageName(stageName: string | null | undefined): ContactStatusLike | null {
  if (!stageName) return null;
  const normalized = stageName.toLowerCase();

  if (normalized.includes("gewonnen") || normalized.includes("won") || normalized.includes("kunde") || normalized.includes("verkauft")) {
    return "Kunde";
  }
  if (normalized.includes("verloren") || normalized.includes("lost") || normalized.includes("nicht verkauft")) {
    return "Verloren";
  }
  return "In Kontakt";
}

async function syncContactStatusForStageName(
  supabase: SupabaseClient,
  contactId: string | null,
  stageName: string | null | undefined
) {
  if (!contactId) return;
  const newStatus = statusFromStageName(stageName);
  if (!newStatus) return;

  const { error } = await supabase.from("contacts").update({ status: newStatus }).eq("id", contactId);
  if (error) {
    console.error("syncContactStatusForStageName contact update error:", error.message);
  }
}

async function resolveProjectIdForContact(
  supabase: SupabaseClient,
  contactId: string | null
): Promise<string | null> {
  if (contactId) {
    const { data } = await supabase.from("contacts").select("project_id").eq("id", contactId).maybeSingle();
    if (data?.project_id) return data.project_id;
  }
  return await getActiveProjectId();
}

async function bridgeLegacyStageToPipelineStage(
  supabase: SupabaseClient,
  projectId: string | null,
  legacyStageName: string | null | undefined
): Promise<string | null> {
  if (!projectId || !legacyStageName) return null;
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("project_id", projectId)
    .ilike("name", legacyStageName)
    .maybeSingle();
  return data?.id ?? null;
}

async function bridgePipelineStageToLegacyStage(
  supabase: SupabaseClient,
  legacyPipelineId: string | null,
  pipelineStageName: string | null | undefined
): Promise<string | null> {
  if (!legacyPipelineId || !pipelineStageName) return null;
  const { data } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", legacyPipelineId)
    .ilike("name", pipelineStageName)
    .maybeSingle();
  return data?.id ?? null;
}

const DEALS_LIST_SELECT = `
  id, name, pipeline_id, stage_id, contact_id, value, created_at, country, address, industry,
  contact:contacts ( id, first_name, last_name, email, phone, company, country, address, industry )
`;

// "Mehr laden": lädt den nächsten Batch der Deals-Tabelle nach (siehe getAllDeals in data.ts).
// sortKey/sortDir MUSS mit dem Aufruf übereinstimmen, der die bereits geladenen
// Zeilen erzeugt hat — sonst ist der angehängte Batch nicht global sortiert.
export async function loadMoreDeals(
  offset: number,
  limit = 100,
  sortKey?: DealSortKey,
  sortDir: SortDir = "asc"
): Promise<ActionResult<Deal[]>> {
  const supabase = await createClient();

  // Server Actions sind über ihre Action-ID direkt POST-bar, unabhängig von der
  // Middleware/dem Dashboard-Layout, das die Seite ursprünglich gerendert hat —
  // daher hier eine eigene Auth-Prüfung statt sich auf proxy.ts zu verlassen.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const ascending = sortDir === "asc";

  let query = supabase.from("deals").select(DEALS_LIST_SELECT);

  switch (sortKey) {
    case "name":
      query = query.order("name", { ascending });
      break;
    case "company":
      query = query.order("company", { ascending, referencedTable: "contacts" });
      break;
    case "country":
      query = query.order("country", { ascending, referencedTable: "contacts" });
      break;
    case "phone":
      query = query.order("phone", { ascending, referencedTable: "contacts" });
      break;
    case "email":
      query = query.order("email", { ascending, referencedTable: "contacts" });
      break;
    case "address":
      query = query.order("address", { ascending, referencedTable: "contacts" });
      break;
    case "industry":
      query = query.order("industry", { ascending, referencedTable: "contacts" });
      break;
    case "status":
      query = query.order("stage_id", { ascending });
      break;
    case "createdAt":
      query = query.order("created_at", { ascending });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.order("id", { ascending: true }).range(offset, offset + limit - 1);

  if (error) {
    console.error("loadMoreDeals error:", error.message);
    return { success: false, message: error.message };
  }

  return { success: true, data: (data ?? []) as unknown as Deal[] };
}

const COUNTRY_FILTER_PAGE_SIZE = 1000;
const COUNTRY_FILTER_MAX_ROWS = 10000;

// Lädt ALLE Deals eines Landes (nicht nur die ersten 100), damit der Land-Filter
// auch Deals findet, die noch nicht im Browser geladen sind. Sprachunabhängig:
// "Deutschland" findet auch "Almanya"/"Germany" (siehe countryIlikePatterns).
// PostgREST kann kein OR über deals.country UND contacts.country in einem Query,
// daher zwei Abfragen — analog zur Anzeige-Logik "deal.country || contact.country".
export async function loadDealsByCountry(country: string): Promise<ActionResult<Deal[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const orFilter = countryIlikePatterns(country)
    .map((p) => `country.ilike."${p}"`)
    .join(",");

  async function fetchAll(build: () => any): Promise<Deal[]> {
    const rows: Deal[] = [];
    for (let offset = 0; offset < COUNTRY_FILTER_MAX_ROWS; offset += COUNTRY_FILTER_PAGE_SIZE) {
      const { data, error } = await build()
        .order("id", { ascending: true })
        .range(offset, offset + COUNTRY_FILTER_PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as Deal[]));
      if (!data || data.length < COUNTRY_FILTER_PAGE_SIZE) break;
    }
    return rows;
  }

  try {
    const [byDealCountry, byContactCountry] = await Promise.all([
      // 1) Land direkt am Deal gepflegt
      fetchAll(() => supabase.from("deals").select(DEALS_LIST_SELECT).or(orFilter)),
      // 2) Deal ohne eigenes Land -> Land des verknüpften Kontakts
      fetchAll(() =>
        supabase
          .from("deals")
          .select(DEALS_LIST_SELECT.replace("contact:contacts (", "contact:contacts!inner ("))
          .or('country.is.null,country.eq.""')
          .or(orFilter, { referencedTable: "contact" })
      ),
    ]);

    const merged = new Map<string, Deal>();
    for (const deal of [...byDealCountry, ...byContactCountry]) merged.set(deal.id, deal);
    return { success: true, data: Array.from(merged.values()) };
  } catch (err) {
    const message = (err as { message?: string }).message ?? "Unbekannter Fehler";
    console.error("loadDealsByCountry error:", message);
    return { success: false, message };
  }
}

export async function updateDealStage(
  dealId: string,
  newStageId: string
): Promise<ActionResult<Deal>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const { data: stageRow, error: stageError } = await supabase
    .from("deal_stages")
    .select("name")
    .eq("id", newStageId)
    .maybeSingle();

  if (stageError) {
    console.error("updateDealStage stage lookup error:", stageError.message);
  }

  const { data: dealBefore } = await supabase
    .from("deals")
    .select("project_id")
    .eq("id", dealId)
    .maybeSingle();

  const bridgedPipelineStageId = await bridgeLegacyStageToPipelineStage(
    supabase,
    dealBefore?.project_id ?? null,
    stageRow?.name
  );

  const { data, error } = await supabase
    .from("deals")
    .update({
      stage_id: newStageId,
      ...(bridgedPipelineStageId ? { pipeline_stage_id: bridgedPipelineStageId } : {}),
    })
    .eq("id", dealId)
    .select(DEAL_SELECT)
    .single();

  if (error) {
    console.error("updateDealStage error:", error.message);
    return { success: false, message: error.message };
  }

  const dealRecord = data as unknown as Deal;
  await syncContactStatusForStageName(supabase, dealRecord.contact_id, stageRow?.name);

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/kontakte");
  if (dealRecord.contact_id) {
    revalidatePath(`/dashboard/kontakte/${dealRecord.contact_id}`);
  }

  return { success: true, data: dealRecord };
}

export async function updateDealPipelineStage(
  dealId: string,
  newPipelineStageId: string
): Promise<ActionResult<Deal>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const [{ data: dealBefore }, { data: newStage, error: stageError }] = await Promise.all([
    supabase.from("deals").select("pipeline_id, contact_id").eq("id", dealId).maybeSingle(),
    supabase.from("pipeline_stages").select("name").eq("id", newPipelineStageId).maybeSingle(),
  ]);

  if (stageError) {
    console.error("updateDealPipelineStage stage lookup error:", stageError.message);
  }

  const bridgedLegacyStageId = await bridgePipelineStageToLegacyStage(
    supabase,
    dealBefore?.pipeline_id ?? null,
    newStage?.name
  );

  const { data, error } = await supabase
    .from("deals")
    .update({
      pipeline_stage_id: newPipelineStageId,
      ...(bridgedLegacyStageId ? { stage_id: bridgedLegacyStageId } : {}),
    })
    .eq("id", dealId)
    .select(DEAL_SELECT)
    .single();

  if (error) {
    console.error("updateDealPipelineStage error:", error.message);
    return { success: false, message: error.message };
  }

  const dealRecord = data as unknown as Deal;
  await syncContactStatusForStageName(supabase, dealRecord.contact_id, newStage?.name);

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/kontakte");
  if (dealRecord.contact_id) {
    revalidatePath(`/dashboard/kontakte/${dealRecord.contact_id}`);
  }

  return { success: true, data: dealRecord };
}

export type CreateDealState = ActionResult<Deal>;

export async function createDeal(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const name = (formData.get("title") as string)?.trim();
  const pipelineId = formData.get("pipeline_id") as string;
  const stageId = formData.get("stage_id") as string;
  const contactId = (formData.get("contact_id") as string) || null;
  const assignedTo = (formData.get("assigned_to") as string) || null;
  const valueRaw = formData.get("value") as string;

  if (!name || !pipelineId || !stageId) {
    return {
      success: false,
      message: "Name, Pipeline und Phase sind erforderlich.",
    };
  }

  const value = Number(valueRaw?.replace(",", "."));
  if (Number.isNaN(value) || value < 0) {
    return { success: false, message: "Ungültiger Wert." };
  }

  const projectId = await resolveProjectIdForContact(supabase, contactId);

  const { data: stageRow } = await supabase
    .from("deal_stages")
    .select("name")
    .eq("id", stageId)
    .maybeSingle();

  const pipelineStageId = await bridgeLegacyStageToPipelineStage(supabase, projectId, stageRow?.name);

  const { data, error } = await supabase
    .from("deals")
    .insert({
      name,
      pipeline_id: pipelineId,
      stage_id: stageId,
      contact_id: contactId,
      assigned_to: assignedTo,
      value,
      ...(projectId ? { project_id: projectId } : {}),
      ...(pipelineStageId ? { pipeline_stage_id: pipelineStageId } : {}),
    })
    .select(DEAL_SELECT)
    .single();

  if (error) {
    console.error("createDeal error:", error.message);
    return { success: false, message: error.message };
  }

  const dealRecord = data as unknown as Deal;
  await syncContactStatusForStageName(supabase, dealRecord.contact_id, stageRow?.name);

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/kontakte");
  if (dealRecord.contact_id) {
    revalidatePath(`/dashboard/kontakte/${dealRecord.contact_id}`);
  }

  return { success: true, data: dealRecord };
}
