"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type ExportRow = Record<string, unknown>;

export type ExportResult = {
  success: boolean;
  message?: string;
  rows?: ExportRow[];
};

// ==================== EXPORT ====================

export async function exportContacts(): Promise<ExportResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, company, position, address, country, status, notes, assigned_to, last_contacted_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("exportContacts error:", error.message);
    return { success: false, message: error.message };
  }

  return { success: true, rows: data ?? [] };
}

export async function exportDeals(): Promise<ExportResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(
      `
      id, name, value, created_at,
      contact:contacts ( first_name, last_name, email, phone, company, country ),
      stage:deal_stages!deals_stage_id_fkey ( name ),
      pipeline:pipelines ( name )
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("exportDeals error:", error.message);
    return { success: false, message: error.message };
  }

  const flattened = (data ?? []).map((raw) => {
    const d = raw as any;
    const contact = Array.isArray(d.contact) ? d.contact[0] : d.contact;
    const stage = Array.isArray(d.stage) ? d.stage[0] : d.stage;
    const pipeline = Array.isArray(d.pipeline) ? d.pipeline[0] : d.pipeline;

    return {
      id: d.id,
      deal_name: d.name,
      pipeline: pipeline?.name ?? "",
      stage: stage?.name ?? "",
      contact_name: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "",
      contact_email: contact?.email ?? "",
      contact_phone: contact?.phone ?? "",
      contact_company: contact?.company ?? "",
      contact_country: contact?.country ?? "",
      value: d.value,
      created_at: d.created_at,
    };
  });

  return { success: true, rows: flattened };
}

// ==================== IMPORT ====================

export type ImportContactRow = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  /**
   * Freitext-Feld "Deal": entweder ein Standardwert (z. B. "Neukunde") oder
   * eine Pipeline-Bezeichnung/-Kürzel (z. B. "Döner"), anhand dessen die
   * Ziel-Pipeline für den automatisch angelegten Deal bestimmt wird.
   */
  deal_name?: string;
  event_category?: string;
  notes?: string;
};

export type ImportResult = {
  success: boolean;
  message?: string;
  imported: number;
  updated: number;
  dealsCreated: number;
  errors?: string[];
};

function splitFullName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

type PipelineRow = { id: string; name: string };
type StageRow = { id: string; pipeline_id: string; name: string; position: number };

function resolveTargetPipeline(
  pipelines: PipelineRow[],
  dealNameRaw: string | undefined
): PipelineRow | null {
  if (pipelines.length === 0) return null;
  const dealName = dealNameRaw?.trim().toLowerCase();

  if (dealName) {
    const match = pipelines.find(
      (p) =>
        p.name.toLowerCase().includes(dealName) || dealName.includes(p.name.toLowerCase())
    );
    if (match) return match;
  }

  return pipelines[0];
}

function resolveFirstStage(stages: StageRow[], pipelineId: string): StageRow | null {
  const stagesForPipeline = stages
    .filter((s) => s.pipeline_id === pipelineId)
    .sort((a, b) => a.position - b.position);
  return stagesForPipeline[0] ?? null;
}

/**
 * Importiert Kontakte aus einer geparsten Zeilenliste (Client parst die Datei mit xlsx).
 * - Dubletten werden anhand der E-Mail-Adresse per Update statt Insert behandelt (upsert-Logik).
 * - Für jeden Kontakt ohne bestehenden Deal wird automatisch ein Deal angelegt. Die Ziel-Pipeline
 *   wird über das Feld "Deal" bestimmt (Freitext-Match auf den Pipeline-Namen), ansonsten wird
 *   die erste Pipeline (alphabetisch) als Standard verwendet. Der Deal-Wert wird beim Import
 *   nicht mehr erfasst und startet immer bei 0.
 * - "Land" wird, sofern vorhanden, in contacts.country gespeichert.
 * - "Event-Kategorie" hat keine eigene Spalte im Schema und wird an contacts.notes angehängt.
 */
export async function importContactsWithDeals(
  rows: ImportContactRow[]
): Promise<ImportResult> {
  if (!rows || rows.length === 0) {
    return {
      success: false,
      message: "Keine Zeilen zum Importieren gefunden.",
      imported: 0,
      updated: 0,
      dealsCreated: 0,
    };
  }

  const supabase = await createClient();
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;
  let dealsCreated = 0;

  const { data: pipelines, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id, name")
    .order("name", { ascending: true });

  if (pipelineError) {
    console.error("importContactsWithDeals pipeline lookup error:", pipelineError.message);
  }

  const { data: stages, error: stageError } = await supabase
    .from("deal_stages")
    .select("id, pipeline_id, name, position")
    .order("position", { ascending: true });

  if (stageError) {
    console.error("importContactsWithDeals stage lookup error:", stageError.message);
  }

  const pipelineList: PipelineRow[] = pipelines ?? [];
  const stageList: StageRow[] = stages ?? [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const email = row.email?.trim();

    let firstName = row.first_name?.trim() ?? "";
    let lastName = row.last_name?.trim() ?? "";
    if (!firstName && !lastName && row.full_name) {
      const split = splitFullName(row.full_name);
      firstName = split.first;
      lastName = split.last;
    }

    if (!firstName || !lastName) {
      errors.push(`Zeile ${rowNumber}: Name ist erforderlich.`);
      continue;
    }

    const country = row.country?.trim() || null;
    const eventCategory = row.event_category?.trim();
    const rawNotes = row.notes?.trim();
    const notesParts = [
      eventCategory ? `Event-Kategorie: ${eventCategory}` : null,
      rawNotes || null,
    ].filter(Boolean);
    const notesSuffix = notesParts.length > 0 ? notesParts.join(" | ") : null;

    // E-Mail ist optional: ohne E-Mail kann keine Dublette erkannt werden,
    // in diesem Fall wird immer ein neuer Kontakt angelegt.
    let existing: { id: string; notes: string | null } | null = null;
    if (email) {
      const { data: found, error: findError } = await supabase
        .from("contacts")
        .select("id, notes")
        .eq("email", email)
        .maybeSingle();

      if (findError) {
        errors.push(`Zeile ${rowNumber}: Fehler beim Suchen (${findError.message}).`);
        continue;
      }
      existing = found;
    }

    let contactId: string;

    if (existing) {
      const mergedNotes = notesSuffix
        ? [existing.notes, notesSuffix].filter(Boolean).join(" · ")
        : existing.notes;

      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: row.phone?.trim() || null,
          company: row.company?.trim() || null,
          country,
          notes: mergedNotes,
        })
        .eq("id", existing.id);

      if (updateError) {
        errors.push(`Zeile ${rowNumber}: Fehler beim Aktualisieren (${updateError.message}).`);
        continue;
      }
      contactId = existing.id;
      updated++;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("contacts")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: row.phone?.trim() || null,
          company: row.company?.trim() || null,
          country,
          status: "Lead",
          notes: notesSuffix,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        errors.push(`Zeile ${rowNumber}: Fehler beim Anlegen (${insertError?.message ?? "unbekannt"}).`);
        continue;
      }
      contactId = inserted.id;
      imported++;
    }

    const targetPipeline = resolveTargetPipeline(pipelineList, row.deal_name);
    const targetStage = targetPipeline ? resolveFirstStage(stageList, targetPipeline.id) : null;

    if (targetPipeline && targetStage) {
      const { data: existingDeal, error: dealFindError } = await supabase
        .from("deals")
        .select("id")
        .eq("contact_id", contactId)
        .maybeSingle();

      if (dealFindError) {
        errors.push(`Zeile ${rowNumber}: Kontakt gespeichert, Deal-Prüfung fehlgeschlagen (${dealFindError.message}).`);
        continue;
      }

      if (!existingDeal) {
        const dealLabel = row.deal_name?.trim() || "Neukunde";
        const { error: dealError } = await supabase.from("deals").insert({
          name: `${dealLabel} – ${firstName} ${lastName}`,
          pipeline_id: targetPipeline.id,
          stage_id: targetStage.id,
          contact_id: contactId,
          value: 0,
        });

        if (dealError) {
          errors.push(`Zeile ${rowNumber}: Kontakt gespeichert, aber Deal-Erstellung fehlgeschlagen (${dealError.message}).`);
        } else {
          dealsCreated++;
        }
      }
    } else {
      errors.push(`Zeile ${rowNumber}: Keine passende Pipeline/Phase gefunden, Deal nicht angelegt.`);
    }
  }

  revalidatePath("/dashboard/kontakte");
  revalidatePath("/dashboard/deals");

  const total = imported + updated;

  return {
    success: total > 0,
    imported,
    updated,
    dealsCreated,
    errors: errors.length > 0 ? errors : undefined,
    message:
      total > 0
        ? `${imported} neu angelegt, ${updated} aktualisiert, ${dealsCreated} Deal(s) erstellt.${
            errors.length ? ` ${errors.length} Zeile(n) mit Fehlern.` : ""
          }`
        : "Es konnte kein einziger Datensatz importiert werden.",
  };
}