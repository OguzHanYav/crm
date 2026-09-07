// Lokal ausführen: node scripts/build-fixed-import.mjs ["/pfad/zur/quelle.xlsx"]
// Liest die Rohdatei (Header stehen erst ab einer Titel-/Leerzeile, Spalten in
// türkischer Sprache: Firma, Ülke, Branş, E-posta, Telefon 1/2, Adres) und
// schreibt eine bereinigte Datei crm_ready_import_fixed.xlsx im Projekt-Root mit
// den Spalten: Name, Firma, Land, E-Mail, Telefon, Branche, Adresse,
// Event-Kategorie, Status, Deal-Wert, Notizen — Header direkt in Zeile 1.
// Adresse/Branche stehen als EIGENE Felder (nicht mehr nur in Notizen verkettet).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const sourcePath =
  process.argv[2] || path.join(os.homedir(), "Documents", "doner_firma_rehberi_duzenli (1).xlsx");
const outputPath = path.join(projectRoot, "crm_ready_import_fixed.xlsx");

const HEADER_KEYWORDS = [
  "no", "firma", "company", "ülke", "ulke", "land", "country",
  "branş", "brans", "e-posta", "eposta", "email", "e-mail",
  "telefon", "phone", "adres", "address",
];

function detectHeaderRowIndex(sheet) {
  const preview = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  for (let i = 0; i < Math.min(preview.length, 10); i++) {
    const cells = preview[i].map((c) => String(c ?? "").trim().toLowerCase());
    const matches = cells.filter((c) => HEADER_KEYWORDS.some((kw) => c.includes(kw))).length;
    if (matches >= 3) return i;
  }
  return 0;
}

function findValue(row, matcher) {
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) continue;
    if (matcher(String(key).trim().toLowerCase())) {
      const str = String(value).trim();
      if (str) return str;
    }
  }
  return "";
}

const getFirma = (row) => findValue(row, (k) => k.includes("firma") || k.includes("company"));
const getLand = (row) => findValue(row, (k) => k.includes("ülke") || k.includes("ulke") || k.includes("land") || k.includes("country"));
const getEmail = (row) => findValue(row, (k) => k.includes("e-posta") || k.includes("eposta") || k.includes("e-mail") || k.includes("email"));
const getBranche = (row) => findValue(row, (k) => k.includes("branş") || k.includes("brans"));
const getAdres = (row) => findValue(row, (k) => k.includes("adres") || k.includes("address"));
const getTelefon1 = (row) => findValue(row, (k) => k.includes("telefon") && k.includes("1"));
const getTelefon2 = (row) => findValue(row, (k) => k.includes("telefon") && k.includes("2"));
const getTelefonFallback = (row) => findValue(row, (k) => k.includes("telefon") || k.includes("phone"));

console.log(`Lese Quelldatei: ${sourcePath}`);
const buffer = readFileSync(sourcePath);
const workbook = XLSX.read(buffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const headerRowIndex = detectHeaderRowIndex(sheet);
const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: headerRowIndex });
console.log(`Header-Zeile erkannt bei Index ${headerRowIndex} (Zeile ${headerRowIndex + 1}), ${rawRows.length} Datenzeilen.`);

const fixedRows = rawRows
  .map((row) => {
    const firma = getFirma(row);
    if (!firma) return null;

    const telefon = getTelefon1(row) || getTelefonFallback(row);
    const telefon2 = getTelefon2(row);
    const branche = getBranche(row);
    const adres = getAdres(row);

    // Nur noch echter Rest (Telefon 2) in Notizen — Adresse/Branche haben jetzt
    // eigene Spalten und werden nicht mehr in Notizen verkettet.
    const notizen = telefon2 ? `Telefon 2: ${telefon2}` : "";

    return {
      Name: firma,
      Firma: firma,
      Land: getLand(row) || "",
      "E-Mail": getEmail(row) || "",
      Telefon: telefon || "",
      Branche: branche || "",
      Adresse: adres || "",
      "Event-Kategorie": branche || "",
      Status: "Lead",
      "Deal-Wert": 0,
      Notizen: notizen,
    };
  })
  .filter(Boolean);

console.log(`${fixedRows.length} gültige Zeilen (mit Firma) aufbereitet.`);

const worksheet = XLSX.utils.json_to_sheet(fixedRows, {
  header: [
    "Name",
    "Firma",
    "Land",
    "E-Mail",
    "Telefon",
    "Branche",
    "Adresse",
    "Event-Kategorie",
    "Status",
    "Deal-Wert",
    "Notizen",
  ],
});
const outWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWorkbook, worksheet, "Import");
XLSX.writeFile(outWorkbook, outputPath);

console.log(`Geschrieben: ${outputPath}`);
