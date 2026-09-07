import WebSocket from "ws";
globalThis.WebSocket = WebSocket;

// Lokal ausführen (nach build-fixed-import.mjs): node scripts/sync-from-fixed-import.mjs
// Liest crm_ready_import_fixed.xlsx aus dem Projekt-Root, lädt ALLE bestehenden
// contacts/deals vorab in den Speicher und matcht per normalisiertem Firmennamen
// (Kleinbuchstaben, Diakritika/Sonderzeichen entfernt) bzw. E-Mail — robust gegen
// Schreibweisen wie "Rivelli Tamplaş" vs. "RIVELLI TAMPLAS". Aktualisiert
// country/address/industry (und Wert/Notizen) in contacts UND deals.
// Voraussetzung: add-deals-country-column.sql, add-deals-address-column.sql und
// add-industry-column.sql wurden bereits ausgeführt.

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

// Kleinbuchstaben, Diakritika (ü/ş/ç/ö/ı...) und Sonderzeichen entfernen, damit
// "RIVELLI TAMPLAS" und "Rivelli Tamplaş" auf denselben Schlüssel matchen.
const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeKey(str) {
  return String(str ?? "")
    .normalize("NFKD")
    .replace(COMBINING_MARKS_RE, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitName(full) {
  const trimmed = full.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

async function fetchAll(table, select) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table} laden fehlgeschlagen: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function getDefaultStage() {
  const { data: pipelines } = await supabase.from("pipelines").select("id").order("name", { ascending: true }).limit(1);
  const pipelineId = pipelines?.[0]?.id;
  if (!pipelineId) throw new Error("Keine Pipeline gefunden.");

  const { data: followUp } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .ilike("name", "Follow-up")
    .maybeSingle();
  if (followUp?.id) return { pipelineId, stageId: followUp.id };

  const { data: stages } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true })
    .limit(1);
  if (!stages?.[0]?.id) throw new Error("Keine Stage gefunden.");
  return { pipelineId, stageId: stages[0].id };
}

async function main() {
  const filePath = path.join(projectRoot, "crm_ready_import_fixed.xlsx");
  console.log(`Lese: ${filePath}`);
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`${rows.length} Excel-Zeilen gefunden.`);

  console.log("Lade bestehende contacts/deals aus Supabase ...");
  const [allContacts, allDeals] = await Promise.all([
    fetchAll("contacts", "id, email, company, country, address, industry, phone"),
    fetchAll("deals", "id, contact_id, name, country, address, industry, value"),
  ]);
  console.log(`  ${allContacts.length} Kontakte, ${allDeals.length} Deals geladen.`);

  const contactsByEmail = new Map();
  const contactsByCompanyKey = new Map();
  for (const c of allContacts) {
    if (c.email) contactsByEmail.set(c.email.trim().toLowerCase(), c);
    const key = normalizeKey(c.company);
    if (key && !contactsByCompanyKey.has(key)) contactsByCompanyKey.set(key, c);
  }

  const dealsByContactId = new Map();
  const dealsByNameKey = new Map();
  for (const d of allDeals) {
    if (d.contact_id) {
      if (!dealsByContactId.has(d.contact_id)) dealsByContactId.set(d.contact_id, []);
      dealsByContactId.get(d.contact_id).push(d);
    }
    const key = normalizeKey(d.name);
    if (key && !dealsByNameKey.has(key)) dealsByNameKey.set(key, d);
  }

  const { pipelineId, stageId } = await getDefaultStage();

  let contactsCreated = 0;
  let contactsUpdated = 0;
  let dealsCreated = 0;
  let dealsUpdated = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = String(row["Name"] ?? "").trim();
    const company = String(row["Firma"] ?? "").trim();
    const companyKey = normalizeKey(company);
    const country = String(row["Land"] ?? "").trim() || null;
    const email = String(row["E-Mail"] ?? "").trim() || null;
    const phone = String(row["Telefon"] ?? "").trim() || null;
    const address = String(row["Adresse"] ?? "").trim() || null;
    const industry = String(row["Branche"] ?? "").trim() || null;
    const notes = String(row["Notizen"] ?? "").trim() || null;
    const dealValue = Number(row["Deal-Wert"]) || 0;

    if (!company && !email) {
      skipped++;
      continue;
    }

    let contact = (email && contactsByEmail.get(email.trim().toLowerCase())) || contactsByCompanyKey.get(companyKey) || null;

    let contactId;
    if (contact) {
      const { error } = await supabase
        .from("contacts")
        .update({
          company: company || undefined,
          country,
          address,
          industry,
          phone: phone || undefined,
          notes: notes || undefined,
        })
        .eq("id", contact.id);
      if (error) {
        console.error("Kontakt-Update-Fehler:", company || email, error.message);
        continue;
      }
      contactId = contact.id;
      contact.country = country;
      contact.address = address;
      contact.industry = industry;
      contactsUpdated++;
    } else {
      const { first, last } = splitName(name || company);
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          first_name: first,
          last_name: last,
          email: email ?? `${companyKey.replace(/ /g, "-") || "unbekannt"}@unbekannt.import`,
          phone,
          company: company || null,
          country,
          address,
          industry,
          status: "Lead",
          notes,
        })
        .select("id, email, company, country, address, industry")
        .single();
      if (error) {
        console.error("Kontakt-Insert-Fehler:", company || email, error.message);
        continue;
      }
      contactId = data.id;
      contact = data;
      if (email) contactsByEmail.set(email.trim().toLowerCase(), contact);
      if (companyKey) contactsByCompanyKey.set(companyKey, contact);
      contactsCreated++;
    }

    // Deal-Match: zuerst über bereits verknüpften Kontakt, sonst über normalisierten Namen.
    const existingDeal = (dealsByContactId.get(contactId) || [])[0] || dealsByNameKey.get(companyKey) || null;

    if (existingDeal) {
      const updatePayload = { country, address, industry, value: dealValue };
      if (!existingDeal.contact_id) updatePayload.contact_id = contactId;
      const { error } = await supabase.from("deals").update(updatePayload).eq("id", existingDeal.id);
      if (error) {
        console.error("Deal-Update-Fehler:", company || email, error.message);
        continue;
      }
      dealsUpdated++;
    } else {
      const { data, error } = await supabase
        .from("deals")
        .insert({
          name: company || name,
          pipeline_id: pipelineId,
          stage_id: stageId,
          contact_id: contactId,
          value: dealValue,
          country,
          address,
          industry,
        })
        .select("id, contact_id, name, country, address, industry")
        .single();
      if (error) {
        console.error("Deal-Insert-Fehler:", company || email, error.message);
        continue;
      }
      if (!dealsByContactId.has(contactId)) dealsByContactId.set(contactId, []);
      dealsByContactId.get(contactId).push(data);
      dealsByNameKey.set(companyKey, data);
      dealsCreated++;
    }
  }

  console.log("Fertig.");
  console.log(`  Kontakte neu:          ${contactsCreated}`);
  console.log(`  Kontakte aktualisiert: ${contactsUpdated}`);
  console.log(`  Deals neu:             ${dealsCreated}`);
  console.log(`  Deals aktualisiert:    ${dealsUpdated}`);
  console.log(`  Übersprungen:          ${skipped}`);

  // Fallback: alle noch verbliebenen Deals ohne Land/Adresse/Branche, deren
  // Kontakt einen Wert hat.
  console.log("Fallback-Pass: country/address/industry von contacts auf verbleibende deals kopieren ...");
  let fallbackCopied = 0;
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error } = await supabase
      .from("deals")
      .select("id, contact_id, country, address, industry, contact:contacts ( country, address, industry )")
      .or("country.is.null,address.is.null,industry.is.null")
      .not("contact_id", "is", null)
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Fallback-Fehler:", error.message);
      break;
    }
    if (!page || page.length === 0) break;
    for (const deal of page) {
      const c = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact;
      if (!c) continue;
      const patch = {};
      if (!deal.country && c.country) patch.country = c.country;
      if (!deal.address && c.address) patch.address = c.address;
      if (!deal.industry && c.industry) patch.industry = c.industry;
      if (Object.keys(patch).length === 0) continue;

      const { error: updErr } = await supabase.from("deals").update(patch).eq("id", deal.id);
      if (!updErr) fallbackCopied++;
    }
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`  Fallback kopiert: ${fallbackCopied}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
