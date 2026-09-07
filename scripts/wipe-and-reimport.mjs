import WebSocket from "ws";
globalThis.WebSocket = WebSocket;

// Löscht ALLE Kontakte/Deals/Notizen/Anrufe unwiderruflich und importiert sie aus
// crm_ready_import_fixed.xlsx neu. Sicherheitshalber nur mit --confirm ausführen:
//   node scripts/wipe-and-reimport.mjs --confirm
// (Tabellen "activities"/"companies" existieren in diesem Schema nicht — company
// ist ein Textfeld auf contacts; stattdessen werden die tatsächlich verknüpften
// Tabellen deal_stage_history/call_logs/notes/deals/contacts geleert.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

function loadEnvLocal() {
  let content;
  try {
    content = readFileSync(path.join(projectRoot, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

if (!process.argv.includes("--confirm")) {
  console.error("ABBRUCH: Dies löscht ALLE Kontakte/Deals unwiderruflich.");
  console.error("Zum Ausführen: node scripts/wipe-and-reimport.mjs --confirm");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Fehlende NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { enabled: false },
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

async function wipeAll() {
  // Reihenfolge wegen Foreign-Key-Constraints: erst abhängige Tabellen, dann deals, dann contacts.
  // In einer Schleife löschen, bis die Tabelle wirklich leer ist (PostgREST liefert
  // pro Delete ggf. nur einen begrenzten Batch zurück) — sonst bleiben Reste/Dubletten übrig.
  const tables = ["deal_stage_history", "call_logs", "notes", "deals", "contacts"];
  for (const table of tables) {
    console.log(`Lösche alle Zeilen aus "${table}" ...`);
    while (true) {
      const { data, error } = await supabase.from(table).delete().neq("id", NIL_UUID).select("id");
      if (error) {
        console.error(`Fehler beim Löschen von "${table}":`, error.message);
        process.exit(1);
      }
      if (!data || data.length === 0) break;
    }
  }
  console.log("Bereinigung abgeschlossen. Prüfe verbleibende Zeilen ...");

  const { count: contactsCount, error: contactsCountError } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });
  const { count: dealsCount, error: dealsCountError } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true });

  if (contactsCountError || dealsCountError) {
    throw new Error(
      `Zählabfrage fehlgeschlagen: ${contactsCountError?.message ?? dealsCountError?.message}`
    );
  }
  if ((contactsCount ?? 0) !== 0 || (dealsCount ?? 0) !== 0) {
    throw new Error(
      `Löschen unvollständig: contacts=${contactsCount}, deals=${dealsCount} (erwartet: 0). Abbruch vor Re-Import.`
    );
  }
  console.log("  contacts: 0, deals: 0 — sauber.\n");
}

async function getDefaultStage() {
  const { data: pipelines } = await supabase.from("pipelines").select("id").order("name", { ascending: true }).limit(1);
  const pipelineId = pipelines?.[0]?.id;
  if (!pipelineId) throw new Error("Keine Pipeline gefunden.");

  const { data: incoming } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .ilike("name", "Anfrage%")
    .maybeSingle();
  if (incoming?.id) return { pipelineId, stageId: incoming.id };

  const { data: stages } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true })
    .limit(1);
  if (!stages?.[0]?.id) throw new Error("Keine Stage gefunden.");
  return { pipelineId, stageId: stages[0].id };
}

function splitName(full) {
  const trimmed = full.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

async function main() {
  await wipeAll();

  const filePath = path.join(projectRoot, "crm_ready_import_fixed.xlsx");
  console.log(`Lese: ${filePath}`);
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`${rows.length} Zeilen gefunden.\n`);

  const { pipelineId, stageId } = await getDefaultStage();

  // Jede E-Mail muss eindeutig sein (contacts_email_key) — Duplikate/leere Werte
  // aus der Excel-Datei erhalten einen eindeutigen Fallback bzw. Suffix.
  const usedEmails = new Set();
  function uniqueEmail(rawEmail, index) {
    const base = rawEmail.trim().toLowerCase();
    if (!base) {
      const fallback = `import-${index + 1}@unbekannt.import`;
      usedEmails.add(fallback);
      return fallback;
    }
    if (!usedEmails.has(base)) {
      usedEmails.add(base);
      return base;
    }
    const [local, domain] = base.split("@");
    let n = 1;
    let candidate = `${local}+${n}@${domain}`;
    while (usedEmails.has(candidate)) {
      n++;
      candidate = `${local}+${n}@${domain}`;
    }
    usedEmails.add(candidate);
    return candidate;
  }

  const contactRows = rows.map((row, i) => {
    const name = String(row["Name"] ?? "").trim();
    const company = String(row["Firma"] ?? "").trim();
    const { first, last } = splitName(name || company || `Kontakt ${i + 1}`);
    const email = uniqueEmail(String(row["E-Mail"] ?? ""), i);
    const country = String(row["Land"] ?? "").trim() || null;

    return {
      first_name: first,
      last_name: last,
      email,
      phone: String(row["Telefon"] ?? "").trim() || null,
      company: company || null,
      country,
      status: "Lead",
      notes: String(row["Notizen"] ?? "").trim() || null,
      _dealName: company || name || `Deal ${i + 1}`,
      _dealValue: Number(row["Deal-Wert"]) || 0,
      _country: country,
    };
  });

  let contactsInserted = 0;
  let dealsInserted = 0;
  const batches = chunk(contactRows, 100);

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`Batch ${b + 1}/${batches.length}: ${batch.length} Kontakte ...`);

    const { data: insertedContacts, error: contactError } = await supabase
      .from("contacts")
      .insert(
        batch.map((c) => ({
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          country: c.country,
          status: c.status,
          notes: c.notes,
        }))
      )
      .select("id");

    if (contactError || !insertedContacts) {
      console.error(`Fehler beim Insert von Kontakten (Batch ${b + 1}):`, contactError?.message);
      continue;
    }
    contactsInserted += insertedContacts.length;

    const dealsPayload = insertedContacts.map((c, i) => ({
      name: batch[i]._dealName,
      pipeline_id: pipelineId,
      stage_id: stageId,
      contact_id: c.id,
      value: batch[i]._dealValue,
      country: batch[i]._country,
    }));

    const { error: dealError } = await supabase.from("deals").insert(dealsPayload);
    if (dealError) {
      console.error(`Fehler beim Insert von Deals (Batch ${b + 1}):`, dealError.message);
      continue;
    }
    dealsInserted += dealsPayload.length;

    console.log(`  -> ${contactsInserted}/${contactRows.length} Kontakte, ${dealsInserted}/${contactRows.length} Deals importiert.`);
  }

  console.log("\nFertig.");
  console.log(`  Kontakte importiert: ${contactsInserted}`);
  console.log(`  Deals importiert:    ${dealsInserted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
