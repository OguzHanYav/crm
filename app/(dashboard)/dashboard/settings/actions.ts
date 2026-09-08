"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type ExportRow = Record<string, unknown>;

export type ExportResult = {
  success: boolean;
  message?: string;
  rows?: ExportRow[];
};

// ==================== HILFSFUNKTIONEN ====================
const READ_PAGE_SIZE = 1000;
const WRITE_CHUNK_SIZE = 500;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function fetchAllPaginated<T>(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; error?: string }> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + READ_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      return { rows, error: error.message };
    }
    if (!data || data.length === 0) break;

    rows.push(...data);

    if (data.length < READ_PAGE_SIZE) break;
    from += READ_PAGE_SIZE;
  }

  return { rows };
}

// ==================== EXPORT ====================

export async function exportContacts(): Promise<ExportResult> {
  try {
    const supabase = await createClient();

    const { rows, error } = await fetchAllPaginated((from, to) =>
      supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, email, phone, company, position, address, country, status, notes, assigned_to, last_contacted_at, created_at"
        )
        .order("created_at", { ascending: false })
        .range(from, to)
    );

    if (error) {
      console.error("exportContacts Fehler:", error);
      return { success: false, message: error };
    }

    return { success: true, rows: rows as unknown as ExportRow[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("exportContacts Exception:", err);
    return { success: false, message };
  }
}

export async function exportDeals(): Promise<ExportResult> {
  try {
    const supabase = await createClient();

    const { rows, error } = await fetchAllPaginated((from, to) =>
      supabase
        .from("deals")
        .select(
          `
        id, name, value, created_at,
        contact:contacts ( first_name, last_name, email, phone, company ),
        stage:deal_stages!deals_stage_id_fkey ( name ),
        pipeline:pipelines ( name )
        `
        )
        .order("created_at", { ascending: false })
        .range(from, to)
    );

    if (error) {
      console.error("exportDeals Fehler:", error);
      return { success: false, message: error };
    }

    const flattened = rows.map((raw) => {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("exportDeals Exception:", err);
    return { success: false, message };
  }
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
  status?: string;
  deal_value?: string;
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

const VALID_STATUSES = ["Lead", "In Kontakt", "Kunde", "Verloren"];

// ---- Robustes Spalten-Mapping ----
type RawImportRow = Record<string, unknown>;

const FIELD_ALIASES: Record<string, string[]> = {
  full_name: ["full_name", "fullname", "name", "vollständiger name", "kontaktname", "voller name"],
  first_name: ["first_name", "firstname", "vorname"],
  last_name: ["last_name", "lastname", "nachname"],
  email: ["email", "e-mail", "mail", "emailadresse", "e mail", "e-posta", "eposta"],
  phone: ["phone", "telefon", "handy", "mobile", "tel", "telefonnummer", "telefon 1"],
  company: ["company", "firma", "unternehmen", "organisation"],
  country: ["country", "land", "ülke", "ulke"],
  status: ["status", "phase", "stage"],
  deal_value: ["deal_value", "deal-wert", "dealwert", "wert", "value", "umsatz"],
  deal_name: ["deal_name", "deal-name", "dealname", "titel", "deal titel"],
  event_category: ["event_category", "event-kategorie", "eventkategorie", "kategorie", "category"],
  notes: ["notes", "notizen", "bemerkung", "kommentar"],
};

function normalizeHeader(key: string): string {
  return key.trim().toLowerCase();
}

function readField(row: RawImportRow, canonical: keyof typeof FIELD_ALIASES): string {
  const aliases = FIELD_ALIASES[canonical];

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) continue;
    if (aliases.includes(normalizeHeader(key))) {
      const str = String(value).trim();
      if (str.length > 0) return str;
    }
  }
  return "";
}

function splitFullName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function parseDealValue(raw: string): number {
  if (!raw) return 0;
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

type PreparedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  country: string | null;
  status: string;
  notesSuffix: string | null;
  dealValue: number;
  dealName: string | null;
  existingContactId: string | null;
  existingNotes: string | null;
};

async function resolveDefaultStageId(supabase: any): Promise<{ pipelineId: string; stageId: string } | null> {
  const { data: pipelines, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(1);

  if (pipelineError || !pipelines || pipelines.length === 0) {
    console.error("Keine Pipeline gefunden!");
    return null;
  }

  const pipelineId = pipelines[0].id;

  const { data: followUpStage } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .ilike("name", "Follow-up")
    .maybeSingle();

  if (followUpStage?.id) {
    return { pipelineId, stageId: followUpStage.id };
  }

  const { data: stages, error: stageError } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true })
    .limit(1);

  if (stageError || !stages || stages.length === 0) {
    console.error("Keine Stage für Pipeline gefunden!");
    return null;
  }

  return { pipelineId, stageId: stages[0].id };
}

// ==================== SCHNELLER BULK-IMPORT ====================

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

  try {
  const supabase = await createClient();
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;
  let dealsCreated = 0;

  // ---- Standard-Pipeline / Stage ermitteln ----
  const defaultStage = await resolveDefaultStageId(supabase);
  if (!defaultStage) {
    return {
      success: false,
      message: "Keine Pipeline/Stage in der Datenbank gefunden. Bitte zuerst eine Pipeline anlegen.",
      imported: 0,
      updated: 0,
      dealsCreated: 0,
    };
  }

  console.log(`[Import] Starte Import von ${rows.length} Zeile(n) …`);

  // ---- 1) ALLE E-Mails aus der Excel sammeln ----
  const emails: string[] = [];
  for (const raw of rows) {
    const email = readField(raw as unknown as RawImportRow, "email");
    if (email) emails.push(email);
  }
  const uniqueEmails = [...new Set(emails)].filter(Boolean);

  console.log(`[Import] ${uniqueEmails.length} eindeutige E-Mail-Adressen gefunden`);

  // ---- 2) BULK-LOOKUP: Alle bestehenden Kontakte mit einer Query holen ----
  const existingByEmail = new Map<string, { id: string; notes: string | null }>();

  for (const chunk of chunkArray(uniqueEmails, 1000)) {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, email, notes")
        .in("email", chunk);

      if (error) {
        console.error("Bulk-Lookup Fehler:", error);
        continue;
      }

      if (data) {
        for (const c of data) {
          if (c.email) existingByEmail.set(c.email, { id: c.id, notes: c.notes });
        }
      }
    } catch (err) {
      console.error("Bulk-Lookup Exception:", err);
    }
  }

  console.log(`[Import] ${existingByEmail.size} bestehende Kontakte gefunden`);

  // ---- 3) Zeilen vorbereiten (inkl. Deduplizierung INNERHALB der Datei) ----
  const prepared: PreparedRow[] = [];
  const seenEmailsInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as unknown as RawImportRow;
    const rowNumber = i + 2;

    const email = readField(raw, "email") || null;
    const company = readField(raw, "company") || null;
    const phone = readField(raw, "phone") || null;

    let firstName = readField(raw, "first_name");
    let lastName = readField(raw, "last_name");
    let usedDefaultName = false;

    if (!firstName && !lastName) {
      const fullName = readField(raw, "full_name");
      if (fullName) {
        const split = splitFullName(fullName);
        firstName = split.first;
        lastName = split.last;
      }
    }

    if (!firstName && !lastName && company) {
      const split = splitFullName(company);
      firstName = split.first;
      lastName = split.last;
    }

    if (!firstName && !lastName && email && email.includes("@")) {
      const prefix = email.split("@")[0]?.trim();
      if (prefix) {
        const split = splitFullName(prefix);
        firstName = split.first;
        lastName = split.last;
      }
    }

    if (!firstName && !lastName) {
      const split = splitFullName("Unbekannter Kontakt");
      firstName = split.first;
      lastName = split.last;
      usedDefaultName = true;
    }

    if (usedDefaultName && !company && !email && !phone) {
      errors.push(
        `Zeile ${rowNumber}: Übersprungen – weder Name, Firma, E-Mail noch Telefon vorhanden.`
      );
      continue;
    }

    // ---- Dubletten-Check INNERHALB der Datei ----
    if (email) {
      if (seenEmailsInFile.has(email)) {
        errors.push(
          `Zeile ${rowNumber}: Dublette (E-Mail "${email}" bereits weiter oben in der Datei vorhanden) – übersprungen.`
        );
        continue;
      }
      seenEmailsInFile.add(email);
    }

    const statusRaw = readField(raw, "status");
    const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : "Lead";
    const dealValue = parseDealValue(readField(raw, "deal_value"));
    const eventCategory = readField(raw, "event_category");
    const rawNotes = readField(raw, "notes");
    const notesParts = [
      eventCategory ? `Event-Kategorie: ${eventCategory}` : null,
      rawNotes || null,
    ].filter(Boolean);
    const notesSuffix = notesParts.length > 0 ? notesParts.join(" | ") : null;

    const existing = email ? existingByEmail.get(email) ?? null : null;

    prepared.push({
      rowNumber,
      firstName,
      lastName,
      email,
      phone,
      company,
      country: readField(raw, "country") || null,
      status,
      notesSuffix,
      dealValue,
      dealName: readField(raw, "deal_name") || null,
      existingContactId: existing?.id ?? null,
      existingNotes: existing?.notes ?? null,
    });
  }

  if (prepared.length === 0) {
    return {
      success: false,
      message: "Keine verwertbaren Zeilen gefunden.",
      imported: 0,
      updated: 0,
      dealsCreated: 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ---- 4) In Insert- und Update-Kandidaten aufteilen ----
  const toInsert = prepared.filter((p) => !p.existingContactId);
  const toUpdate = prepared.filter((p) => p.existingContactId);

  console.log(`[Import] ${toInsert.length} neue Kontakte, ${toUpdate.length} bestehende Kontakte`);

  const contactIdByRow = new Map<number, string>();

  // ---- 5) NEUE Kontakte einfügen (BULK) ----
  for (const chunk of chunkArray(toInsert, WRITE_CHUNK_SIZE)) {
    const payload = chunk.map((p) => ({
      id: randomUUID(),
      first_name: p.firstName,
      last_name: p.lastName,
      email: p.email,
      phone: p.phone,
      company: p.company,
      country: p.country,
      status: p.status,
      notes: p.notesSuffix,
    }));

    try {
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) throw error;

      chunk.forEach((p, idx) => contactIdByRow.set(p.rowNumber, payload[idx].id));
      imported += chunk.length;
      console.log(`[Import] Kontakte eingefügt: ${chunk.length} (gesamt: ${imported})`);
    } catch (err) {
      const error = err as any;
      const message = error.message || "Unbekannter Fehler";
      const first = chunk[0]?.rowNumber;
      const last = chunk[chunk.length - 1]?.rowNumber;
      errors.push(`Zeilen ${first}–${last}: Insert fehlgeschlagen (${message})`);
      console.error("Insert Fehler:", error);
    }
  }

  // ---- 6) BESTEHENDE Kontakte aktualisieren (BULK UPSERT) ----
  for (const chunk of chunkArray(toUpdate, WRITE_CHUNK_SIZE)) {
    const payload = chunk.map((p) => {
      const mergedNotes = p.notesSuffix
        ? [p.existingNotes, p.notesSuffix].filter(Boolean).join(" · ")
        : p.existingNotes;

      return {
        id: p.existingContactId as string,
        first_name: p.firstName,
        last_name: p.lastName,
        email: p.email,
        phone: p.phone,
        company: p.company,
        country: p.country,
        status: p.status,
        notes: mergedNotes,
      };
    });

    try {
      const { error } = await supabase.from("contacts").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      chunk.forEach((p) => contactIdByRow.set(p.rowNumber, p.existingContactId as string));
      updated += chunk.length;
      console.log(`[Import] Kontakte aktualisiert: ${chunk.length} (gesamt: ${updated})`);
    } catch (err) {
      const error = err as any;
      const message = error.message || "Unbekannter Fehler";
      const first = chunk[0]?.rowNumber;
      const last = chunk[chunk.length - 1]?.rowNumber;
      errors.push(`Zeilen ${first}–${last}: Update fehlgeschlagen (${message})`);
      console.error("Update Fehler:", error);
    }
  }

  // ---- 7) Deals anlegen ----
  const allContactIds = [...contactIdByRow.values()];
  console.log(`[Import] Prüfe bestehende Deals für ${allContactIds.length} Kontakt(e) …`);

  const contactIdsWithDeal = new Set<string>();

  for (const idChunk of chunkArray(allContactIds, WRITE_CHUNK_SIZE)) {
    try {
      const { rows: dealRows, error: dealLookupError } = await fetchAllPaginated<{
        contact_id: string;
      }>((from, to) =>
        supabase.from("deals").select("contact_id").in("contact_id", idChunk).range(from, to)
      );

      if (dealLookupError) throw new Error(dealLookupError);

      for (const d of dealRows) {
        if (d.contact_id) contactIdsWithDeal.add(d.contact_id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      errors.push(
        `Deal-Lookup fehlgeschlagen (${message}). Betroffene Kontakte erhalten keinen neuen Deal.`
      );
      idChunk.forEach((id) => contactIdsWithDeal.add(id));
    }
  }

  const dealsToInsert: { rowNumber: number; payload: Record<string, unknown> }[] = [];
  for (const p of prepared) {
    const contactId = contactIdByRow.get(p.rowNumber);
    if (!contactId) continue;
    if (contactIdsWithDeal.has(contactId)) continue;

    dealsToInsert.push({
      rowNumber: p.rowNumber,
      payload: {
        name: p.dealName || `Deal – ${p.firstName} ${p.lastName}`.trim(),
        pipeline_id: defaultStage.pipelineId,
        stage_id: defaultStage.stageId,
        contact_id: contactId,
        value: p.dealValue,
      },
    });
  }

  for (const chunk of chunkArray(dealsToInsert, WRITE_CHUNK_SIZE)) {
    try {
      const { error } = await supabase.from("deals").insert(chunk.map((d) => d.payload));
      if (error) throw error;

      dealsCreated += chunk.length;
      console.log(`[Import] Deals eingefügt: ${chunk.length} (gesamt: ${dealsCreated})`);
    } catch (err) {
      const error = err as any;
      const message = error.message || "Unbekannter Fehler";
      const first = chunk[0]?.rowNumber;
      const last = chunk[chunk.length - 1]?.rowNumber;
      errors.push(`Zeilen ${first}–${last}: Deal-Insert fehlgeschlagen (${message})`);
      console.error("Deal-Insert Fehler:", error);
    }
  }

  revalidatePath("/dashboard/kontakte");
  revalidatePath("/dashboard/deals");

  const total = imported + updated;
  console.log(
    `[Import] Fertig. Neu: ${imported}, aktualisiert: ${updated}, Deals: ${dealsCreated}, Fehler: ${errors.length}`
  );

  return {
    success: total > 0,
    imported,
    updated,
    dealsCreated,
    errors: errors.length > 0 ? errors : undefined,
    message:
      total > 0
        ? `${imported} neu angelegt, ${updated} aktualisiert, ${dealsCreated} Deal(s) erstellt.${
            errors.length ? ` ${errors.length} Meldung(en).` : ""
          }`
        : "Es konnte kein einziger Datensatz importiert werden.",
  };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("importContactsWithDeals Exception:", err);
    return {
      success: false,
      message,
      imported: 0,
      updated: 0,
      dealsCreated: 0,
    };
  }
}
