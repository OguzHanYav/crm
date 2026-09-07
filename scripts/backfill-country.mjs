// Einmalig lokal ausführen: node scripts/backfill-country.mjs ["/pfad/zur/datei.xlsx"]
// Vorher: supabase/sql/add-deals-country-column.sql in Supabase ausführen (fügt deals.country hinzu).
// Phase 1: liest die Excel-Datei ein, gleicht Zeilen anhand E-Mail (bevorzugt) oder Firma mit
//   bestehenden Kontakten ab und füllt nur LEERE contacts.country-Werte.
// Phase 2: kopiert contacts.country auf alle verknüpften deals mit leerem country-Feld.
// Nutzt den Service-Role-Key aus .env.local, um RLS für den Bulk-Fix zu umgehen.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  let content;
  try {
    content = readFileSync(envPath, "utf8");
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
});

const filePath =
  process.argv[2] || path.join(os.homedir(), "Documents", "doner_firma_rehberi_duzenli (1).xlsx");

const HEADER_KEYWORDS = [
  "name", "email", "e-mail", "e-posta", "eposta", "mail",
  "telefon", "phone", "firma", "company", "land", "ülke", "ulke", "country", "branş", "brans",
];

function detectHeaderRowIndex(sheet) {
  const preview = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  for (let i = 0; i < Math.min(preview.length, 10); i++) {
    const cells = preview[i].map((c) => String(c ?? "").trim().toLowerCase());
    const matches = cells.filter((c) => HEADER_KEYWORDS.some((kw) => c.includes(kw))).length;
    if (matches >= 2) return i;
  }
  return 0;
}

function findValue(row, aliases) {
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) continue;
    const norm = String(key).trim().toLowerCase();
    if (aliases.some((a) => norm.includes(a))) {
      const str = String(value).trim();
      if (str) return str;
    }
  }
  return "";
}

const EMAIL_ALIASES = ["email", "e-mail", "e-posta", "eposta", "mail"];
const COMPANY_ALIASES = ["firma", "company", "unternehmen"];
const COUNTRY_ALIASES = ["ülke", "ulke", "land", "country"];

async function main() {
  console.log(`Lese Datei: ${filePath}`);
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const headerRowIndex = detectHeaderRowIndex(sheet);
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: headerRowIndex });
  console.log(`Header-Zeile erkannt bei Index ${headerRowIndex}, ${rows.length} Datenzeilen gefunden.`);

  let updatedByEmail = 0;
  let updatedByCompany = 0;
  let alreadySet = 0;
  let noCountryInFile = 0;
  let notFound = 0;

  for (const row of rows) {
    const email = findValue(row, EMAIL_ALIASES);
    const company = findValue(row, COMPANY_ALIASES);
    const country = findValue(row, COUNTRY_ALIASES);

    if (!country) {
      noCountryInFile++;
      continue;
    }

    let matched = null;
    if (email) {
      const { data } = await supabase.from("contacts").select("id, country").eq("email", email).maybeSingle();
      matched = data ?? null;
    }
    if (!matched && company) {
      const { data } = await supabase
        .from("contacts")
        .select("id, country")
        .ilike("company", company)
        .limit(1)
        .maybeSingle();
      matched = data ?? null;
    }

    if (!matched) {
      notFound++;
      continue;
    }
    if (matched.country) {
      alreadySet++;
      continue;
    }

    const { error } = await supabase.from("contacts").update({ country }).eq("id", matched.id);
    if (error) {
      console.error("Update-Fehler für Kontakt", matched.id, error.message);
      continue;
    }
    if (email) updatedByEmail++;
    else updatedByCompany++;
  }

  console.log("Phase 1 (contacts) fertig.");
  console.log(`  Aktualisiert per E-Mail:        ${updatedByEmail}`);
  console.log(`  Aktualisiert per Firma:         ${updatedByCompany}`);
  console.log(`  Bereits gesetzt (übersprungen): ${alreadySet}`);
  console.log(`  Kein Land in Datei:             ${noCountryInFile}`);
  console.log(`  Kein passender Kontakt:         ${notFound}`);

  // ---- Phase 2: deals.country von verknüpften Kontakten übernehmen ----
  // Deckt auch Deals ab, deren contact_id nicht in dieser Datei vorkam bzw. deren
  // Kontakt schon vorher (z. B. durch einen früheren Lauf) ein Land erhalten hat.
  console.log("Phase 2: Kopiere Land von verknüpften Kontakten auf Deals ...");
  let dealsCopied = 0;
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data: dealsPage, error } = await supabase
      .from("deals")
      .select("id, contact_id, country, contact:contacts ( country )")
      .is("country", null)
      .not("contact_id", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Fehler beim Laden der Deals:", error.message);
      break;
    }
    if (!dealsPage || dealsPage.length === 0) break;

    for (const deal of dealsPage) {
      const contactCountry = Array.isArray(deal.contact) ? deal.contact[0]?.country : deal.contact?.country;
      if (!contactCountry) continue;

      const { error: updateError } = await supabase
        .from("deals")
        .update({ country: contactCountry })
        .eq("id", deal.id);

      if (updateError) {
        console.error("Update-Fehler für Deal", deal.id, updateError.message);
        continue;
      }
      dealsCopied++;
    }

    if (dealsPage.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`  Deals mit Land von Kontakt befüllt: ${dealsCopied}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
