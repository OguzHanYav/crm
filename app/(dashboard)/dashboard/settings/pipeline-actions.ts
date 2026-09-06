"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type PipelineStageRow = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  is_active: boolean;
};

export type PipelineActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

const SETTINGS_PATH = "/dashboard/settings";
const DEALS_PATH = "/dashboard/deals";

async function getOrCreateDefaultPipelineId(): Promise<string | null> {
  const supabase = await createClient();

  const { data: pipelines, error } = await supabase
    .from("pipelines")
    .select("id")
    .order("name", { ascending: true })
    .limit(1);

  if (error) {
    console.error("getOrCreateDefaultPipelineId error:", error.message);
    return null;
  }

  if (pipelines && pipelines.length > 0) return pipelines[0].id;

  const { data: created, error: createError } = await supabase
    .from("pipelines")
    .insert({ name: "Standard-Pipeline" })
    .select("id")
    .single();

  if (createError) {
    console.error("getOrCreateDefaultPipelineId create error:", createError.message);
    return null;
  }

  return created?.id ?? null;
}

export async function getPipelineStagesForSettings(): Promise<PipelineStageRow[]> {
  const pipelineId = await getOrCreateDefaultPipelineId();
  if (!pipelineId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_stages")
    .select("id, pipeline_id, name, position, color, is_active")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getPipelineStagesForSettings error:", error.message);
    return [];
  }

  return data ?? [];
}

export async function toggleStageActive(
  stageId: string,
  isActive: boolean
): Promise<PipelineActionResult<PipelineStageRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_stages")
    .update({ is_active: isActive })
    .eq("id", stageId)
    .select("id, pipeline_id, name, position, color, is_active")
    .single();

  if (error) {
    console.error("toggleStageActive error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(DEALS_PATH);
  return { success: true, data: data as PipelineStageRow };
}

export async function createPipelineStage(
  name: string,
  color: string
): Promise<PipelineActionResult<PipelineStageRow>> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, message: "Bitte einen Namen für die Phase angeben." };
  }

  const pipelineId = await getOrCreateDefaultPipelineId();
  if (!pipelineId) {
    return { success: false, message: "Keine Pipeline gefunden." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("deal_stages")
    .select("position")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("deal_stages")
    .insert({
      pipeline_id: pipelineId,
      name: trimmed,
      position: nextPosition,
      color: color || "#2563EB",
      is_active: true,
    })
    .select("id, pipeline_id, name, position, color, is_active")
    .single();

  if (error) {
    console.error("createPipelineStage error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(DEALS_PATH);
  return { success: true, data: data as PipelineStageRow };
}

export async function updatePipelineStage(
  stageId: string,
  name: string,
  color: string
): Promise<PipelineActionResult<PipelineStageRow>> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, message: "Name darf nicht leer sein." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_stages")
    .update({ name: trimmed, color: color || "#2563EB" })
    .eq("id", stageId)
    .select("id, pipeline_id, name, position, color, is_active")
    .single();

  if (error) {
    console.error("updatePipelineStage error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(DEALS_PATH);
  return { success: true, data: data as PipelineStageRow };
}

export async function deletePipelineStage(stageId: string): Promise<PipelineActionResult> {
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", stageId);

  if (countError) {
    console.error("deletePipelineStage count error:", countError.message);
  }

  if (count && count > 0) {
    return {
      success: false,
      message: `Phase kann nicht gelöscht werden: ${count} Deal(s) sind ihr noch zugeordnet.`,
    };
  }

  const { error } = await supabase.from("deal_stages").delete().eq("id", stageId);

  if (error) {
    console.error("deletePipelineStage error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(DEALS_PATH);
  return { success: true };
}

export async function moveStagePosition(
  stageId: string,
  direction: "up" | "down"
): Promise<PipelineActionResult> {
  const supabase = await createClient();

  const { data: stage, error: stageError } = await supabase
    .from("deal_stages")
    .select("id, pipeline_id, position")
    .eq("id", stageId)
    .single();

  if (stageError || !stage) {
    return { success: false, message: stageError?.message ?? "Phase nicht gefunden." };
  }

  const { data: neighbors, error: neighborsError } = await supabase
    .from("deal_stages")
    .select("id, position")
    .eq("pipeline_id", stage.pipeline_id)
    .order("position", { ascending: true });

  if (neighborsError || !neighbors) {
    return { success: false, message: neighborsError?.message ?? "Phasen konnten nicht geladen werden." };
  }

  const index = neighbors.findIndex((s) => s.id === stageId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapIndex < 0 || swapIndex >= neighbors.length) {
    return { success: true };
  }

  const current = neighbors[index];
  const target = neighbors[swapIndex];

  const { error: updateAError } = await supabase
    .from("deal_stages")
    .update({ position: target.position })
    .eq("id", current.id);

  const { error: updateBError } = await supabase
    .from("deal_stages")
    .update({ position: current.position })
    .eq("id", target.id);

  if (updateAError || updateBError) {
    return { success: false, message: updateAError?.message ?? updateBError?.message };
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(DEALS_PATH);
  return { success: true };
}
