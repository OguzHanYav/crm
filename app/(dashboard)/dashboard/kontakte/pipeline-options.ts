"use server";

import { createClient } from "@/utils/supabase/server";
import { NEW_CUSTOMER_STAGE_NAME } from "@/app/(dashboard)/dashboard/deals/new-customer-stage";

export type PipelineStageOptions = {
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId: string }[];
  // Vorauswahl: Phase "Neuer Kunde" (sonst erste Phase der ersten Pipeline)
  defaultPipelineId: string | null;
  defaultStageId: string | null;
};

// Pipelines und aktive Phasen des aktiven Mandanten (RLS) für "Neuen Kontakt anlegen".
export async function getPipelineStageOptions(): Promise<PipelineStageOptions> {
  const supabase = await createClient();
  const [{ data: pipelines }, { data: stages }] = await Promise.all([
    supabase.from("pipelines").select("id, name").order("name", { ascending: true }),
    supabase
      .from("deal_stages")
      .select("id, name, pipeline_id, position, is_active")
      .order("position", { ascending: true }),
  ]);

  const activeStages = (stages ?? [])
    .filter((s) => s.is_active !== false)
    .map((s) => ({ id: s.id as string, name: s.name as string, pipelineId: s.pipeline_id as string }));
  const pipelineList = (pipelines ?? []).filter((p) => activeStages.some((s) => s.pipelineId === p.id));

  const preferred =
    activeStages.find((s) => s.name.trim().toLowerCase() === NEW_CUSTOMER_STAGE_NAME.toLowerCase()) ??
    activeStages.find((s) => s.pipelineId === pipelineList[0]?.id) ??
    null;

  return {
    pipelines: pipelineList,
    stages: activeStages,
    defaultPipelineId: preferred?.pipelineId ?? null,
    defaultStageId: preferred?.id ?? null,
  };
}
