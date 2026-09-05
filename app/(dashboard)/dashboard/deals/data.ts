import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type { Pipeline, DealStage, Deal, Contact, TeamMember } from "./types";

// React.cache dedupliziert identische Aufrufe innerhalb desselben Requests
// (z.B. wenn Deals- und Kontakte-Tab im selben Render Pipelines/Stages/Team
// abfragen). unstable_cache ist hier bewusst NICHT einsetzbar, da createClient()
// auf cookies() (next/headers) basiert und Next.js dynamische Funktionen
// innerhalb von unstable_cache nicht erlaubt (RLS würde sonst umgangen).

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

// Deals + Kontakt + Sales-Rep in EINER Join-Abfrage (kein Waterfall).
// Passend zum Index auf deals(stage_id, contact_id, value, created_at):
// gefiltert nach pipeline_id, sortiert nach created_at (indexed).
export async function getDealsByPipeline(pipelineId: string): Promise<Deal[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      `
      id, name, pipeline_id, stage_id, contact_id, assigned_to, value, created_at,
      contact:contacts ( id, first_name, last_name, email, phone, company, website, last_contacted_at ),
      assigned_profile:profiles!deals_assigned_to_fkey ( id, first_name, last_name, role )
      `
    )
    .eq("pipeline_id", pipelineId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getDealsByPipeline error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Deal[];
}

// Nur für Dropdown/Zuordnung benötigt -> schlanker Select statt '*'
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
