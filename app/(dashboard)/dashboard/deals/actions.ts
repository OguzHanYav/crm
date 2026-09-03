"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDealStage(dealId: string, newStageId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("deals")
    .update({ stage_id: newStageId })
    .eq("id", dealId);

  if (error) {
    console.error("updateDealStage error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath("/dashboard/deals");
  return { success: true };
}

export type CreateDealState = {
  success: boolean;
  message?: string;
};

export async function createDeal(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  const pipelineId = formData.get("pipeline_id") as string;
  const stageId = formData.get("stage_id") as string;
  const contactId = formData.get("contact_id") as string;
  const assignedTo = formData.get("assigned_to") as string;
  const valueRaw = formData.get("value") as string;

  if (!title || !pipelineId || !stageId) {
    return { success: false, message: "Titel, Pipeline und Phase sind erforderlich." };
  }

  const value = Number(valueRaw.replace(",", "."));
  if (Number.isNaN(value) || value < 0) {
    return { success: false, message: "Ungültiger Wert." };
  }

  const { error } = await supabase.from("deals").insert({
    title,
    pipeline_id: pipelineId,
    stage_id: stageId,
    contact_id: contactId || null,
    assigned_to: assignedTo || null,
    value,
    currency: "EUR",
  });

  if (error) {
    console.error("createDeal error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath("/dashboard/deals");
  return { success: true };
}
