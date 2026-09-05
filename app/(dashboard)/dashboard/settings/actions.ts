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
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  status?: string;
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
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();

    if (!email || !firstName || !lastName) {
      errors.push(`Zeile ${rowNumber}: Vorname, Nachname und E-Mail sind erforderlich.`);
      continue;
    }

    const status = VALID_STATUSES.includes(row.status ?? "") ? (row.status as string) : "Lead";

    const { data: existing, error: findError } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      errors.push(`Zeile ${rowNumber}: Fehler beim Suchen (${findError.message}).`);
      continue;
    }

    let contactId: string;

    if (existing) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: row.phone?.trim() || null,
          company: row.company?.trim() || null,
          status,
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
          value: 0,
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
