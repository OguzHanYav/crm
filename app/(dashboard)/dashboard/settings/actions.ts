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
      contact:contacts ( first_name, last_name, email, phone, company ),
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
  status?: string;
  deal_value?: string;
  event_category?: string;
};

export type ImportResult = {
  success: boolean;
  message?: string;
  imported: number;
  updated: number;
  dealsCreated: number;
  errors?: string[];
};

const VALID_STATUSES = ["Lead", "In Kontakt", "Kunde", "Verloren"];

function splitFullName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function parseDealValue(raw: string | undefined): number {
  if (!raw) return 0;
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Importiert Kontakte aus einer geparsten Zeilenliste (Client parst die Datei mit xlsx).
 * - Dubletten werden anhand der E-Mail-Adresse per Update statt Insert behandelt (upsert-Logik).
 * - Für jeden Kontakt ohne bestehenden Deal wird automatisch ein Deal in der ersten
 *   Pipeline / ersten Phase angelegt (1:1-Beziehung Kontakt <-> Deal), mit optionalem Deal-Wert.
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
    .order("name", { ascending: true })
    .limit(1);

  if (pipelineError) {
    console.error("importContactsWithDeals pipeline lookup error:", pipelineError.message);
  }

  const defaultPipeline = pipelines?.[0] ?? null;
  let defaultStageId: string | null = null;

  if (defaultPipeline) {
    const { data: stages, error: stageError } = await supabase
      .from("deal_stages")
      .select("id, name, position")
      .eq("pipeline_id", defaultPipeline.id)
      .order("position", { ascending: true })
      .limit(1);

    if (stageError) {
      console.error("importContactsWithDeals stage lookup error:", stageError.message);
    }
    defaultStageId = stages?.[0]?.id ?? null;
  }

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

    if (!email || !firstName || !lastName) {
      errors.push(`Zeile ${rowNumber}: Name und E-Mail sind erforderlich.`);
      continue;
    }

    const status = VALID_STATUSES.includes(row.status ?? "") ? (row.status as string) : "Lead";
    const dealValue = parseDealValue(row.deal_value);
    const eventCategory = row.event_category?.trim();
    const notesSuffix = eventCategory ? `Event-Kategorie: ${eventCategory}` : null;

    const { data: existing, error: findError } = await supabase
      .from("contacts")
      .select("id, notes")
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      errors.push(`Zeile ${rowNumber}: Fehler beim Suchen (${findError.message}).`);
      continue;
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
          status,
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
          email,
          phone: row.phone?.trim() || null,
          company: row.company?.trim() || null,
          status,
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

    if (defaultPipeline && defaultStageId) {
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
        const { error: dealError } = await supabase.from("deals").insert({
          name: `Deal – ${firstName} ${lastName}`,
          pipeline_id: defaultPipeline.id,
          stage_id: defaultStageId,
          contact_id: contactId,
          value: dealValue,
        });

        if (dealError) {
          errors.push(`Zeile ${rowNumber}: Kontakt gespeichert, aber Deal-Erstellung fehlgeschlagen (${dealError.message}).`);
        } else {
          dealsCreated++;
        }
      }
    } else {
      errors.push(`Zeile ${rowNumber}: Kein Pipeline/Phase-Standard gefunden, Deal nicht angelegt.`);
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
