import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type { Pipeline, DealStage, PipelineStage, PipelinePhase, Deal, Contact, TeamMember, DealSortKey, SortDir } from "./types";

const DEALS_SELECT = `
  id, name, pipeline_id, stage_id, contact_id, value, created_at, country, address, industry,
  contact:contacts ( id, first_name, last_name, email, phone, company, country, address, industry )
`;

// Wendet den gewählten Sortierschlüssel serverseitig an (inkl. Sortierung nach
// eingebetteten contacts-Feldern) und hängt "id" als stabilen Tiebreaker an, damit
// range()-Pagination über mehrere "Mehr laden"-Aufrufe hinweg konsistent bleibt.
function applyDealsSort(query: any, sortKey: DealSortKey | undefined, sortDir: SortDir) {
  const ascending = sortDir === "asc";

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

  return query.order("id", { ascending: true });
}

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

  // Nur eine VÖLLIG leere Pipeline mit den sechs Standardphasen befüllen. Sobald
  // irgendeine Phase existiert, gilt das Setup als erledigt — sonst würde eine in
  // den Einstellungen bewusst gelöschte Standardphase (z. B. "Follow-up") bei
  // jedem Seitenaufruf hier automatisch wieder auferstehen.
  if (existingStages && existingStages.length > 0) {
    return existingStages
      .map((s) => ({
        id: s.id,
        project_id: pipelineId as string,
        name: s.name,
        position: s.position,
        is_visible: true,
        color: s.color,
      }))
      .sort((a, b) => a.position - b.position);
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

// Gruppiert alle AKTIVEN deal_stages (über sämtliche Pipelines hinweg) nach Namen zu
// Pipeline-Tabs. Dynamisch, d. h. neu in den Einstellungen angelegte Phasen erscheinen
// automatisch als eigener Tab; deaktivierte Phasen fallen komplett weg.
export const getPipelinePhases = cache(async (): Promise<PipelinePhase[]> => {
  await getOrCreateStandardStages();
  const supabase = await createClient();

  const { data: allStages, error } = await supabase
    .from("deal_stages")
    .select("id, pipeline_id, name, position, color, is_active")
    .order("position", { ascending: true });

  if (error) {
    console.error("getPipelinePhases error:", error.message);
    return [];
  }

  const active = (allStages ?? []).filter((s) => s.is_active !== false);

  const groups = new Map<string, { name: string; color: string; position: number; stageIds: string[] }>();
  for (const s of active) {
    const key = s.name.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.stageIds.push(s.id);
      existing.position = Math.min(existing.position, s.position);
    } else {
      groups.set(key, { name: s.name, color: s.color, position: s.position, stageIds: [s.id] });
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => a.position - b.position)
    .map((g) => ({
      key: g.name.trim().toLowerCase(),
      name: g.name,
      color: g.color,
      stageIds: g.stageIds,
      defaultStageId: g.stageIds[0],
    }));
});

// Lädt standardmäßig nur die ersten 100 Deals (Performance); "Mehr laden" ruft
// dieselbe Funktion mit einem höheren offset erneut auf (siehe loadMoreDeals in actions.ts).
export async function getAllDeals(
  limit = 100,
  offset = 0,
  sortKey?: DealSortKey,
  sortDir: SortDir = "asc"
): Promise<Deal[]> {
  const supabase = await createClient();

  let query = supabase.from("deals").select(DEALS_SELECT);
  query = applyDealsSort(query, sortKey, sortDir);
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error("getAllDeals error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Deal[];
}

// Echte Anzahl Deals pro Phase direkt aus der DB (unabhängig davon, wie viele
// Zeilen aktuell client-seitig geladen sind) — je ein exact-count Query pro Phase.
export async function getPhaseCounts(phases: PipelinePhase[]): Promise<Record<string, number>> {
  const supabase = await createClient();

  const entries = await Promise.all(
    phases.map(async (phase) => {
      const { count, error } = await supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .in("stage_id", phase.stageIds);

      if (error) {
        console.error("getPhaseCounts error:", error.message);
        return [phase.key, 0] as const;
      }
      return [phase.key, count ?? 0] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function getDealsTotalCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("deals").select("id", { count: "exact", head: true });
  if (error) {
    console.error("getDealsTotalCount error:", error.message);
    return 0;
  }
  return count ?? 0;
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
