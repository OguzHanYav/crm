"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type ExportRow = Record<string, unknown>;

export type ExportResult = {
  success: boolean;
  message?: string;
  rows?: ExportRow[];
};

const DEFAULT_PROJECT_NAME = "Döner";

// ==================== EXPORT ====================

export async function exportContacts(): Promise<ExportResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, company, position, address, country, status, notes, project_id, assigned_to, last_contacted_at, created_at"
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
      id, name, value, created_at, project_id,
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

// ==================== IMPORT (Batch-optimiert) ====================

export type ImportContactRow = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type NormalizedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  country: string | null;
  dealLabel: string;
  notesSuffix: string | null;
};

/**
 * Batch-optimierter Import: statt ~2.000 einzelner DB-Requests werden
 * bestehende Kontakte in wenigen Bulk-Selects nachgeschlagen, danach läuft
 * EIN Batch-Upsert für alle Kontakte mit E-Mail, EIN Batch-Insert für
 * Kontakte ohne E-Mail und abschließend EIN Batch-Insert für alle neu
 * benötigten Deals (Chunking nur als Sicherheitsnetz bei sehr großen
 * Dateien, jeweils max. 300 Zeilen pro Request).
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

  // ---- 0. Projekt + Pipeline-Referenzen (alt & neu) einmalig laden ----
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("name", DEFAULT_PROJECT_NAME)
    .maybeSingle();

  if (projectError || !project) {
    return {
      success: false,
      message: `Standard-Projekt "${DEFAULT_PROJECT_NAME}" wurde nicht gefunden. Bitte Migration (Schritt A) prüfen.`,
      imported: 0,
      updated: 0,
      dealsCreated: 0,
    };
  }

  const [
    { data: pipelineStages, error: stagesError },
    { data: legacyPipelines, error: legacyPipelineError },
    { data: legacyStages, error: legacyStageError },
  ] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, project_id, name, position, is_visible")
      .eq("project_id", project.id)
      .eq("is_visible", true)
      .order("position", { ascending: true }),
    supabase.from("pipelines").select("id, name").order("name", { ascending: true }),
    supabase
      .from("deal_stages")
      .select("id, pipeline_id, name, position")
      .order("position", { ascending: true }),
  ]);

  if (stagesError) console.error("importContactsWithDeals pipeline_stages error:", stagesError.message);
  if (legacyPipelineError) console.error("importContactsWithDeals legacy pipelines error:", legacyPipelineError.message);
  if (legacyStageError) console.error("importContactsWithDeals legacy deal_stages error:", legacyStageError.message);

  const defaultStage = (pipelineStages ?? [])[0] ?? null;
  if (!defaultStage) {
    return {
      success: false,
      message: `Für Projekt "${DEFAULT_PROJECT_NAME}" ist keine sichtbare Pipeline-Phase konfiguriert.`,
      imported: 0,
      updated: 0,
      dealsCreated: 0,
    };
  }

  // Legacy-Brücke: deals.pipeline_id / deals.stage_id sind bislang NOT NULL
  // und müssen bis zur finalen Migration weiterhin befüllt werden.
  const legacyPipelineList = legacyPipelines ?? [];
  const legacyStageList = legacyStages ?? [];
  const legacyDefaultPipeline =
    legacyPipelineList.find((p) =>
      p.name.toLowerCase().includes(DEFAULT_PROJECT_NAME.toLowerCase())
    ) ??
    legacyPipelineList[0] ??
    null;
  const legacyDefaultStage = legacyDefaultPipeline
    ? legacyStageList
        .filter((s) => s.pipeline_id === legacyDefaultPipeline.id)
        .sort((a, b) => a.position - b.position)[0] ?? null
    : null;

  if (!legacyDefaultPipeline || !legacyDefaultStage) {
    return {
      success: false,
      message: "Keine gültige Legacy-Pipeline/-Phase gefunden (deals.pipeline_id/stage_id erfordern weiterhin einen Wert).",
      imported: 0,
      updated: 0,
      dealsCreated: 0,
    };
  }

  // ---- 1. Alle Zeilen im Speicher normalisieren & validieren ----
  const normalized: NormalizedRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    let firstName = row.first_name?.trim() ?? "";
    let lastName = row.last_name?.trim() ?? "";
    if (!firstName && !lastName && row.full_name) {
      const split = splitFullName(row.full_name);
      firstName = split.first;
      lastName = split.last;
    }

    if (!firstName || !lastName) {
      errors.push(`Zeile ${rowNumber}: Name ist erforderlich.`);
      return;
    }

    const eventCategory = row.event_category?.trim();
    const rawNotes = row.notes?.trim();
    const notesParts = [
      eventCategory ? `Event-Kategorie: ${eventCategory}` : null,
      rawNotes || null,
    ].filter(Boolean);

    normalized.push({
      rowNumber,
      firstName,
      lastName,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      company: row.company?.trim() || null,
      country: row.country?.trim() || null, // Land/Ülke
      dealLabel: row.deal_name?.trim() || "Neukunde",
      notesSuffix: notesParts.length > 0 ? notesParts.join(" | ") : null,
      // Hinweis: "Deal-Wert" wird bewusst nicht mehr eingelesen/verarbeitet.
    });
  });

  if (normalized.length === 0) {
    return {
      success: false,
      message: "Keine gültigen Zeilen zum Importieren gefunden.",
      imported: 0,
      updated: 0,
      dealsCreated: 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ---- 2. EIN Bulk-Select bestehender Kontakte nach E-Mail (für Notes-Merge) ----
  const emails = [...new Set(normalized.map((r) => r.email).filter((e): e is string => !!e))];
  const existingByEmail = new Map<string, { id: string; notes: string | null; status: string | null }>();

  for (const emailChunk of chunk(emails, 300)) {
    const { data: existingContacts, error: existingError } = await supabase
      .from("contacts")
      .select("id, email, notes, status")
      .eq("project_id", project.id)
      .in("email", emailChunk);

    if (existingError) {
      console.error("importContactsWithDeals existing-contacts lookup error:", existingError.message);
      continue;
    }

    for (const c of existingContacts ?? []) {
      if (c.email) existingByEmail.set(c.email, { id: c.id, notes: c.notes, status: c.status });
    }
  }

  // ---- 3. Contacts-Payload bauen (In-Memory Merge) ----
  const contactsPayload = normalized.map((r) => {
    const existing = r.email ? existingByEmail.get(r.email) : undefined;
    const mergedNotes = existing
      ? [existing.notes, r.notesSuffix].filter(Boolean).join(" | ") || null
      : r.notesSuffix;

    return {
      first_name: r.firstName,
      last_name: r.lastName,
      email: r.email,
      phone: r.phone,
      company: r.company,
      country: r.country,
      status: existing?.status ?? "Lead",
      notes: mergedNotes,
      project_id: project.id,
    };
  });

  const allEntries = normalized.map((r, index) => ({ r, index, payload: contactsPayload[index] }));
  const rowsWithEmail = allEntries.filter((x) => !!x.r.email);
  const rowsWithoutEmail = allEntries.filter((x) => !x.r.email);

  const contactIdByRowIndex = new Map<number, string>();
  let imported = 0;
  let updated = 0;

  // 3a. EIN Batch-Upsert für alle Zeilen MIT E-Mail (onConflict: email)
  for (const batch of chunk(rowsWithEmail, 300)) {
    const { data: upserted, error: upsertError } = await supabase
      .from("contacts")
      .upsert(
        batch.map((b) => b.payload),
        { onConflict: "email" }
      )
      .select("id, email");

    if (upsertError) {
      errors.push(`Batch-Upsert Kontakte fehlgeschlagen (${upsertError.message}).`);
      continue;
    }

    const idByEmail = new Map((upserted ?? []).map((row) => [row.email as string, row.id as string]));
    for (const b of batch) {
      const cid = b.r.email ? idByEmail.get(b.r.email) : undefined;
      if (!cid) {
        errors.push(`Zeile ${b.r.rowNumber}: Kontakt-ID nach Upsert nicht gefunden.`);
        continue;
      }
      contactIdByRowIndex.set(b.index, cid);
      if (b.r.email && existingByEmail.has(b.r.email)) updated++;
      else imported++;
    }
  }

  // 3b. EIN Batch-Insert für alle Zeilen OHNE E-Mail (immer neu)
  for (const batch of chunk(rowsWithoutEmail, 300)) {
    const { data: inserted, error: insertError } = await supabase
      .from("contacts")
      .insert(batch.map((b) => b.payload))
      .select("id");

    if (insertError) {
      errors.push(`Batch-Insert Kontakte (ohne E-Mail) fehlgeschlagen (${insertError.message}).`);
      continue;
    }

    (inserted ?? []).forEach((row, i) => {
      const b = batch[i];
      if (!b) return;
      contactIdByRowIndex.set(b.index, row.id as string);
      imported++;
    });
  }

  // ---- 4. Deals: EIN Bulk-Select bestehender Deals, EIN Batch-Insert neuer Deals ----
  const allContactIds = [...contactIdByRowIndex.values()];
  const contactIdsWithDeal = new Set<string>();

  for (const idChunk of chunk(allContactIds, 300)) {
    const { data: existingDeals, error: dealsLookupError } = await supabase
      .from("deals")
      .select("contact_id")
      .eq("project_id", project.id)
      .in("contact_id", idChunk);

    if (dealsLookupError) {
      console.error("importContactsWithDeals existing-deals lookup error:", dealsLookupError.message);
      continue;
    }

    for (const d of existingDeals ?? []) {
      if (d.contact_id) contactIdsWithDeal.add(d.contact_id);
    }
  }

  const dealsPayload: Record<string, unknown>[] = [];
  const seenInThisRun = new Set<string>();

  normalized.forEach((r, index) => {
    const contactId = contactIdByRowIndex.get(index);
    if (!contactId) return;
    // Kein neuer Deal, wenn der Kontakt im Projekt bereits einen hat
    // (weder aus vorherigen Imports noch mehrfach innerhalb dieses Laufs).
    if (contactIdsWithDeal.has(contactId) || seenInThisRun.has(contactId)) return;

    seenInThisRun.add(contactId);
    dealsPayload.push({
      name: `${r.dealLabel} – ${r.firstName} ${r.lastName}`,
      project_id: project.id,
      pipeline_stage_id: defaultStage.id,
      pipeline_id: legacyDefaultPipeline.id,
      stage_id: legacyDefaultStage.id,
      contact_id: contactId,
      value: 0,
    });
  });

  let dealsCreated = 0;
  for (const batch of chunk(dealsPayload, 300)) {
    const { error: dealsInsertError } = await supabase.from("deals").insert(batch);
    if (dealsInsertError) {
      errors.push(`Batch-Insert Deals fehlgeschlagen (${dealsInsertError.message}).`);
      continue;
    }
    dealsCreated += batch.length;
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
            errors.length ? ` ${errors.length} Meldung(en) — siehe Details.` : ""
          }`
        : "Es konnte kein einziger Datensatz importiert werden.",
  };
}