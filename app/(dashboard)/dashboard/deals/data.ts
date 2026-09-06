import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type { Pipeline, DealStage, PipelineStage, PipelinePhase, Deal, Contact, TeamMember } from "./types";

export const getPipelines = cache(async (): Promise<Pipeline[]> => {
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
});

export const getStagesByPipeline = cache(
  async (pipelineId: string): Promise<DealStage[]> => {
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
);

export const getAllStages = cache(async (): Promise<DealStage[]> => {
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
});

export const getTeamMembers = cache(async (): Promise<TeamMember[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("getTeamMembers error:", error.message);
    return [];
  }
  return data ?? [];
});

// ==================== STANDARD-PIPELINE-PHASEN ====================
const STANDARD_STAGE_DEFS: { name: string; color: string }[] = [
  { name: "Follow-up", color: "#0284C7" },
  { name: "Nicht erreicht", color: "#DC2626" },
  { name: "Erreicht", color: "#2563EB" },
  { name: "Neu / In Bearbeitung", color: "#D97706" },
  { name: "Gewonnen", color: "#16A34A" },
  { name: "Verloren", color: "#64748B" },
];

export const getOrCreateStandardStages = cache(async (): Promise<PipelineStage[]> => {
  const supabase = await createClient();

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(1);

  let pipelineId = pipelines?.[0]?.id as string | undefined;

  if (!pipelineId) {
    const { data: newPipeline, error: createPipelineError } = await supabase
      .from("pipelines")
      .insert({ name: "Standard-Pipeline" })
      .select("id")
      .single();

    if (createPipelineError) {
      console.error("getOrCreateStandardStages pipeline create error:", createPipelineError.message);
      return [];
    }
    pipelineId = newPipeline?.id;
  }

  if (!pipelineId) return [];

  const { data: existingStages, error: stagesError } = await supabase
    .from("deal_stages")
    .select("id, name, position, color")
    .eq("pipeline_id", pipelineId);

  if (stagesError) {
    console.error("getOrCreateStandardStages stages fetch error:", stagesError.message);
  }

  const stagesByName = new Map(
    (existingStages ?? []).map((s) => [s.name.trim().toLowerCase(), s])
  );

  const result: PipelineStage[] = [];

  for (let i = 0; i < STANDARD_STAGE_DEFS.length; i++) {
    const def = STANDARD_STAGE_DEFS[i];
    const key = def.name.trim().toLowerCase();
    let stage = stagesByName.get(key);

    if (!stage) {
      const { data: created, error: createStageError } = await supabase
        .from("deal_stages")
        .insert({ pipeline_id: pipelineId, name: def.name, position: i, color: def.color })
        .select("id, name, position, color")
        .single();

      if (createStageError) {
        console.error("getOrCreateStandardStages stage create error:", createStageError.message);
        continue;
      }
      stage = created ?? undefined;
    }

    if (stage) {
      result.push({
        id: stage.id,
        project_id: pipelineId,
        name: def.name,
        position: i,
        is_visible: true,
        color: def.color,
      });
    }
  }

  return result;
});

// Gruppiert alle deal_stages (über sämtliche Pipelines hinweg) nach Namen, damit
// jeder Pipeline-Tab unabhängig davon greift, welcher Pipeline ein Deal zugeordnet ist.
export const getPipelinePhases = cache(async (): Promise<PipelinePhase[]> => {
  await getOrCreateStandardStages();
  const supabase = await createClient();

  const { data: allStages, error } = await supabase
    .from("deal_stages")
    .select("id, pipeline_id, name, position, color")
    .order("position", { ascending: true });

  if (error) {
    console.error("getPipelinePhases error:", error.message);
    return [];
  }

  const phases: PipelinePhase[] = [];
  for (const def of STANDARD_STAGE_DEFS) {
    const key = def.name.trim().toLowerCase();
    const matches = (allStages ?? []).filter((s) => s.name.trim().toLowerCase() === key);
    if (matches.length === 0) continue;
    phases.push({
      key,
      name: def.name,
      color: def.color,
      stageIds: matches.map((s) => s.id),
      defaultStageId: matches[0].id,
    });
  }
  return phases;
});

export async function getAllDeals(): Promise<Deal[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      `
      id, name, pipeline_id, stage_id, contact_id, assigned_to, value, created_at,
      contact:contacts ( id, first_name, last_name, email, phone, company, country, last_contacted_at ),
      assigned_profile:profiles!deals_assigned_to_fkey ( id, first_name, last_name, role )
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllDeals error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Deal[];
}

export async function getContacts(): Promise<Contact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company")
    .order("last_name", { ascending: true });

  if (error) {
    console.error("getContacts error:", error.message);
    return [];
  }
  return data ?? [];
}
