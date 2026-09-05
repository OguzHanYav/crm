"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Deal } from "./types";

export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

export async function updateDealStage(
  dealId: string,
  newStageId: string
): Promise<ActionResult<Deal>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .update({ deal_stage_id: newStageId })
    .eq("id", dealId)
    .select(
      `
      id, name, pipeline_id, deal_stage_id, contact_id, assigned_to, value, created_at,
      contact:contacts ( id, first_name, last_name, email, phone ),
      assigned_profile:profiles!deals_assigned_to_fkey ( id, first_name, last_name, role )
      `
    )
    .single();

  if (error) {
    console.error("updateDealStage error:", error.message);
    return { success: false, message: error.message };
  }

  const transformedData = {
    ...data,
    stage_id: data.deal_stage_id,
  } as unknown as Deal;

  revalidatePath("/dashboard/deals");
  return { success: true, data: transformedData };
}

export type CreateDealState = {
  success: boolean;
  message?: string;
  errors?: any;
  data?: Deal;
};

export async function createDeal(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim() || (formData.get("title") as string)?.trim();
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
      deal_stage_id: stageId,
      contact_id: contactId,
      assigned_to: assignedTo,
      value,
    })
    .select(
      `
      id, name, pipeline_id, deal_stage_id, contact_id, assigned_to, value, created_at,
      contact:contacts ( id, first_name, last_name, email, phone ),
      assigned_profile:profiles!deals_assigned_to_fkey ( id, first_name, last_name, role )
      `
    )
    .single();

  if (error) {
    console.error("createDeal error:", error.message);
    return { success: false, message: error.message };
  }

  const transformedData = {
    ...data,
    stage_id: data.deal_stage_id,
  } as unknown as Deal;

  revalidatePath("/dashboard/deals");
  return { success: true, data: transformedData };
}
