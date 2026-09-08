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
  // Alle deal_stages-IDs (über sämtliche Pipelines hinweg) mit demselben Namen —
  // Mutationen wirken auf ALLE davon, damit die Phase im gesamten CRM konsistent ist.
  stageIds?: string[];
};

export type PipelineActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

const SETTINGS_PATH = "/dashboard/settings";
const DEALS_PATH = "/dashboard/deals";
const KONTAKTE_PATH = "/dashboard/kontakte";

function revalidateAll() {
  revalidatePath(SETTINGS_PATH);
  revalidatePath(DEALS_PATH);
  revalidatePath(KONTAKTE_PATH);
}

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

// Zentrale Quelle für die Pipeline-Einstellungen: fasst deal_stages über ALLE
// Pipelines hinweg nach Namen zusammen (ein Eintrag pro Phase), damit hier exakt
// dieselbe Gruppierung sichtbar/verwaltbar ist wie in Tabs, Filtern und Modals
// (siehe getPipelinePhases in deals/data.ts). Als Anzeige-Repräsentant dient nach
// Möglichkeit die Zeile der Default-Pipeline.
export async function getPipelineStagesForSettings(): Promise<PipelineStageRow[]> {
  try {
    const defaultPipelineId = await getOrCreateDefaultPipelineId();
    const supabase = await createClient();

    const { data: allStages, error } = await supabase
      .from("deal_stages")
      .select("id, pipeline_id, name, position, color, is_active")
      .order("position", { ascending: true });

    if (error || !allStages) {
      console.error("getPipelineStagesForSettings error:", error?.message);
      return [];
    }

    const groups = new Map<string, PipelineStageRow>();
    for (const s of allStages) {
      const key = s.name.trim().toLowerCase();
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          id: s.id,
          pipeline_id: s.pipeline_id,
          name: s.name,
          position: s.position,
          color: s.color,
          is_active: s.is_active,
          stageIds: [s.id],
        });
      } else {
        existing.stageIds!.push(s.id);
        if (s.pipeline_id === defaultPipelineId) {
          existing.id = s.id;
          existing.pipeline_id = s.pipeline_id;
          existing.position = s.position;
          existing.color = s.color;
          existing.is_active = s.is_active;
        }
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.position - b.position);
  } catch (err) {
    console.error("getPipelineStagesForSettings exception:", err);
    return [];
  }
}

async function findGroupByStageId(stageId: string) {
  const rows = await getPipelineStagesForSettings();
  return rows.find((r) => r.stageIds?.includes(stageId)) ?? null;
}

export async function toggleStageActive(
  stageId: string,
  isActive: boolean
): Promise<PipelineActionResult<PipelineStageRow>> {
  try {
    const supabase = await createClient();

    const { data: stage, error: lookupError } = await supabase
      .from("deal_stages")
      .select("name")
      .eq("id", stageId)
      .maybeSingle();

    if (lookupError || !stage) {
      return { success: false, message: lookupError?.message ?? "Phase nicht gefunden." };
    }

    // Cascade: ALLE deal_stages-Zeilen mit diesem Namen (über alle Pipelines) synchron schalten.
    const { error } = await supabase.from("deal_stages").update({ is_active: isActive }).ilike("name", stage.name);

    if (error) {
      console.error("toggleStageActive error:", error.message);
      return { success: false, message: error.message };
    }

    revalidateAll();
    const updated = await findGroupByStageId(stageId);
    return { success: true, data: updated ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("toggleStageActive exception:", err);
    return { success: false, message };
  }
}

export async function createPipelineStage(
  name: string,
  color: string
): Promise<PipelineActionResult<PipelineStageRow>> {
  try {
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

    revalidateAll();
    return { success: true, data: { ...(data as PipelineStageRow), stageIds: [data.id] } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("createPipelineStage exception:", err);
    return { success: false, message };
  }
}

export async function updatePipelineStage(
  stageId: string,
  name: string,
  color: string
): Promise<PipelineActionResult<PipelineStageRow>> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: "Name darf nicht leer sein." };
    }

    const supabase = await createClient();

    const { data: current, error: lookupError } = await supabase
      .from("deal_stages")
      .select("name")
      .eq("id", stageId)
      .maybeSingle();

    if (lookupError || !current) {
      return { success: false, message: lookupError?.message ?? "Phase nicht gefunden." };
    }

    // Cascade: Umbenennen/Farbe ändern gilt für ALLE Zeilen mit dem bisherigen Namen.
    const { error } = await supabase
      .from("deal_stages")
      .update({ name: trimmed, color: color || "#2563EB" })
      .ilike("name", current.name);

    if (error) {
      console.error("updatePipelineStage error:", error.message);
      return { success: false, message: error.message };
    }

    revalidateAll();
    const rows = await getPipelineStagesForSettings();
    const updated = rows.find((r) => r.name.trim().toLowerCase() === trimmed.toLowerCase());
    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("updatePipelineStage exception:", err);
    return { success: false, message };
  }
}

export async function deletePipelineStage(stageId: string): Promise<PipelineActionResult> {
  try {
    const supabase = await createClient();

    const { data: stage, error: lookupError } = await supabase
      .from("deal_stages")
      .select("name")
      .eq("id", stageId)
      .maybeSingle();

    if (lookupError || !stage) {
      return { success: false, message: lookupError?.message ?? "Phase nicht gefunden." };
    }

    const { data: matches, error: matchError } = await supabase
      .from("deal_stages")
      .select("id")
      .ilike("name", stage.name);

    if (matchError || !matches) {
      return { success: false, message: matchError?.message ?? "Phasen konnten nicht geladen werden." };
    }

    const ids = matches.map((m) => m.id);

    const { count, error: countError } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .in("stage_id", ids);

    if (countError) {
      console.error("deletePipelineStage count error:", countError.message);
    }

    if (count && count > 0) {
      return {
        success: false,
        message: `Phase kann nicht gelöscht werden: ${count} Deal(s) sind ihr (über ${ids.length} Pipeline-Kopien) noch zugeordnet.`,
      };
    }

    const { error } = await supabase.from("deal_stages").delete().in("id", ids);

    if (error) {
      console.error("deletePipelineStage error:", error.message);
      return { success: false, message: error.message };
    }

    revalidateAll();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("deletePipelineStage exception:", err);
    return { success: false, message };
  }
}

export async function moveStagePosition(
  stageId: string,
  direction: "up" | "down"
): Promise<PipelineActionResult<PipelineStageRow[]>> {
  try {
    const rows = (await getPipelineStagesForSettings())
      .filter((r) => r.is_active)
      .sort((a, b) => a.position - b.position);

    const index = rows.findIndex((r) => r.stageIds?.includes(stageId));
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) {
      return { success: true, data: await getPipelineStagesForSettings() };
    }

    const current = rows[index];
    const target = rows[swapIndex];
    const supabase = await createClient();

    // Cascade: Positions-Swap gilt für ALLE Zeilen beider Phasen (alle Pipelines),
    // damit die Reihenfolge überall (Tabs, Filter, Modals) synchron bleibt.
    const { error: updateAError } = await supabase
      .from("deal_stages")
      .update({ position: target.position })
      .in("id", current.stageIds ?? [current.id]);

    const { error: updateBError } = await supabase
      .from("deal_stages")
      .update({ position: current.position })
      .in("id", target.stageIds ?? [target.id]);

    if (updateAError || updateBError) {
      return { success: false, message: updateAError?.message ?? updateBError?.message };
    }

    revalidateAll();
    // Autoritative, frische Liste zurückgeben statt nur {success:true} — der Client
    // gleicht seinen State damit zuverlässig ab, auch wenn der optimistische Swap
    // (z. B. bei gleichen Positionswerten) visuell keinen sichtbaren Unterschied ergab.
    return { success: true, data: await getPipelineStagesForSettings() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("moveStagePosition exception:", err);
    return { success: false, message };
  }
}
