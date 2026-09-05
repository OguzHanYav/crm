"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Deal } from "./types";

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

function statusFromStageName(stageName: string | null | undefined): ContactStatusLike | null {
  if (!stageName) return null;
  const normalized = stageName.toLowerCase();

  if (normalized.includes("gewonnen") || normalized.includes("won") || normalized.includes("kunde")) {
    return "Kunde";
  }
  if (normalized.includes("verloren") || normalized.includes("lost")) {
    return "Verloren";
  }
  return "In Kontakt";
}

async function syncContactStatusForStage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string | null,
  newStageId: string
) {
  if (!contactId) return;

  const { data: stageRow, error: stageError } = await supabase
    .from("deal_stages")
    .select("name")
    .eq("id", newStageId)
    .single();

  if (stageError) {
    console.error("syncContactStatusForStage stage lookup error:", stageError.message);
    return;
  }

  const newStatus = statusFromStageName(stageRow?.name);
  if (!newStatus) return;

  const { error: contactError } = await supabase
    .from("contacts")
    .update({ status: newStatus })
    .eq("id", contactId);

  if (contactError) {
    console.error("syncContactStatusForStage contact update error:", contactError.message);
  }
}

export async function updateDealStage(
  dealId: string,
  newStageId: string
): Promise<ActionResult<Deal>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .update({ stage_id: newStageId })
    .eq("id", dealId)
    .select(DEAL_SELECT)
    .single();

  if (error) {
    console.error("updateDealStage error:", error.message);
    return { success: false, message: error.message };
  }

  const dealRecord = data as unknown as Deal;

  await syncContactStatusForStage(supabase, dealRecord.contact_id, newStageId);

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

  const name = (formData.get("name") as string)?.trim();
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

  const { data, error } = await supabase
    .from("deals")
    .insert({
      name,
      pipeline_id: pipelineId,
      stage_id: stageId,
      contact_id: contactId,
      assigned_to: assignedTo,
      value,
    })
    .select(DEAL_SELECT)
    .single();

  if (error) {
    console.error("createDeal error:", error.message);
    return { success: false, message: error.message };
  }

  const dealRecord = data as unknown as Deal;

  await syncContactStatusForStage(supabase, dealRecord.contact_id, stageId);

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/kontakte");
  if (dealRecord.contact_id) {
    revalidatePath(`/dashboard/kontakte/${dealRecord.contact_id}`);
  }

  return { success: true, data: dealRecord };
}
