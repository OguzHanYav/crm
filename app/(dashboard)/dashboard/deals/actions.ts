"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getActiveProjectId } from "@/utils/projects/active-project";
import type { Deal } from "./types";

export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

const DEAL_SELECT = `
  id, name, pipeline_id, stage_id, project_id, pipeline_stage_id, contact_id, assigned_to, value, created_at,
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

// Brückt eine Legacy-Phase (deal_stages) auf die neue, projekt-gebundene
// Pipeline-Phase (pipeline_stages) anhand des Namens.
async function bridgeLegacyStageToPipelineStage(
  supabase: SupabaseClient,
  projectId: string,
  legacyStageName: string | null | undefined
): Promise<string | null> {
  if (!legacyStageName) return null;
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("project_id", projectId)
    .ilike("name", legacyStageName)
    .maybeSingle();
  return data?.id ?? null;
}

// Brückt in die Gegenrichtung: neue Pipeline-Phase -> passende Legacy-Phase
// innerhalb derselben Legacy-Pipeline (damit alte Ansichten konsistent bleiben).
async function bridgePipelineStageToLegacyStage(
  supabase: SupabaseClient,
  legacyPipelineId: string,
  pipelineStageName: string | null | undefined
): Promise<string | null> {
  if (!pipelineStageName) return null;
  const { data } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", legacyPipelineId)
    .ilike("name", pipelineStageName)
    .maybeSingle();
  return data?.id ?? null;
}

export async function updateDealStage(
  dealId: string,
  newStageId: string
): Promise<ActionResult<Deal>> {
  const supabase = await createClient();

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

  const bridgedPipelineStageId = dealBefore?.project_id
    ? await bridgeLegacyStageToPipelineStage(supabase, dealBefore.project_id, stageRow?.name)
    : null;

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

// Neu: Stage-Wechsel aus der projekt-gebundenen Pipelines-Tabelle heraus.
export async function updateDealPipelineStage(
  dealId: string,
  newPipelineStageId: string
): Promise<ActionResult<Deal>> {
  const supabase = await createClient();

  const [{ data: dealBefore }, { data: newStage, error: stageError }] = await Promise.all([
    supabase.from("deals").select("pipeline_id, contact_id").eq("id", dealId).maybeSingle(),
    supabase.from("pipeline_stages").select("name").eq("id", newPipelineStageId).maybeSingle(),
  ]);

  if (stageError) {
    console.error("updateDealPipelineStage stage lookup error:", stageError.message);
  }

  const bridgedLegacyStageId = dealBefore?.pipeline_id
    ? await bridgePipelineStageToLegacyStage(supabase, dealBefore.pipeline_id, newStage?.name)
    : null;

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

// Deals werden ausschließlich aus der Kontakt-Detailansicht heraus angelegt
// (LinkDealModal); es gibt keinen globalen "Neuer Deal"-Einstiegspunkt mehr.
export async function createDeal(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const supabase = await createClient();

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
  if (!projectId) {
    return { success: false, message: "Kein Projekt gefunden." };
  }

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
      project_id: projectId,
      pipeline_stage_id: pipelineStageId,
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