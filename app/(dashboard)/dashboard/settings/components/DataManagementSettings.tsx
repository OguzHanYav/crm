"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  exportContacts,
  exportDeals,
  importContactsWithDeals,
  type ImportContactRow,
  type ImportResult,
} from "../actions";

type TargetField =
  | "full_name"
  | "email"
  | "phone"
  | "company"
  | "country"
  | "deal_name"
  | "event_category"
  | "notes"
  | "ignore";

const TARGET_FIELDS: { value: TargetField; label: string }[] = [
  { value: "full_name", label: "Name" },
  { value: "email", label: "E-Mail" },
  { value: "phone", label: "Telefon" },
  { value: "company", label: "Firma" },
  { value: "country", label: "Land" },
  { value: "deal_name", label: "Deal" },
  { value: "event_category", label: "Event-Kategorie" },
  { value: "notes", label: "Notizen" },
  { value: "ignore", label: "— ignorieren —" },
];

const AUTO_MATCH: Record<TargetField, string[]> = {
  full_name: ["name", "vorname nachname", "kunde"],
  email: ["email", "e-mail", "mail"],
  phone: ["telefon", "phone", "handy", "mobile", "tel"],
  company: ["firma", "company", "unternehmen", "organisation"],
  country: ["land", "ülke", "ulke", "country"],
  deal_name: ["deal", "pipeline"],
  event_category: ["event-kategorie", "event kategorie", "kategorie", "category"],
  notes: ["notizen", "notes", "bemerkung"],
  ignore: [],
};

function guessField(header: string): TargetField {
  const normalized = header.trim().toLowerCase();
  for (const field of TARGET_FIELDS) {
    if (field.value === "ignore") continue;
    if (AUTO_MATCH[field.value].some((kw) => normalized.includes(kw))) {
      return field.value;
    }
  }
  return "ignore";
}

function downloadWorkbook(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function downloadTemplate() {
  const headers = ["Name", "E-Mail", "Telefon", "Firma", "Land", "Deal", "Event-Kategorie"];
  const exampleRow = [
    "Max Mustermann",
    "max.mustermann@beispiel.de",
    "+49 151 23456789",
    "Muster GmbH",
    "Deutschland",
    "Neukunde",
    "Webinar Q1",
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vorlage");
  XLSX.writeFile(workbook, "import-vorlage.xlsx");
}

type Toast = { type: "success" | "error"; text: string };

export default function DataManagementSettings() {
  const [isExportingContacts, setIsExportingContacts] = useState(false);
  const [isExportingDeals, setIsExportingDeals] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetField>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, startImportTransition] = useTransition();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  }

  async function handleExportContacts() {
    setIsExportingContacts(true);
    try {
      const result = await exportContacts();
      if (!result.success || !result.rows) {
        showToast({ type: "error", text: result.message ?? "Export fehlgeschlagen." });
        return;
      }
      downloadWorkbook(result.rows, "Kontakte", "kontakte-export.xlsx");
      showToast({ type: "success", text: `${result.rows.length} Kontakte exportiert.` });
    } finally {
      setIsExportingContacts(false);
    }
  }

  async function handleExportDeals() {
    setIsExportingDeals(true);
    try {
      const result = await exportDeals();
      if (!result.success || !result.rows) {
        showToast({ type: "error", text: result.message ?? "Export fehlgeschlagen." });
        return;
      }
      downloadWorkbook(result.rows, "Deals", "deals-export.xlsx");
      showToast({ type: "success", text: `${result.rows.length} Deals exportiert.` });
    } finally {
      setIsExportingDeals(false);
    }
  }

  const processFile = useCallback((file: File) => {
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (json.length === 0) {
        showToast({ type: "error", text: "Die Datei enthält keine Zeilen." });
        setHeaders([]);
        setRawRows([]);
        return;
      }

      const detectedHeaders = Object.keys(json[0]);
      const autoMapping: Record<string, TargetField> = {};
      for (const header of detectedHeaders) {
        autoMapping[header] = guessField(header);
      }

      setHeaders(detectedHeaders);
      setRawRows(json);
      setMapping(autoMapping);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function resetImport() {
    setFileName(null);
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleImport() {
    const mappedRows: ImportContactRow[] = rawRows.map((row) => {
      const mapped: Partial<ImportContactRow> = {};
      for (const header of headers) {
        const field = mapping[header];
        if (!field || field === "ignore") continue;
        const value = row[header];
        mapped[field] = value === undefined || value === null ? "" : String(value).trim();
      }
      return {
        full_name: mapped.full_name,
        email: mapped.email ?? "",
        phone: mapped.phone,
        company: mapped.company,
        country: mapped.country,
        deal_name: mapped.deal_name,
        event_category: mapped.event_category,
        notes: mapped.notes,
      };
    });

    startImportTransition(async () => {
      const result = await importContactsWithDeals(mappedRows);
      setImportResult(result);
      showToast({
        type: result.success ? "success" : "error",
        text: result.message ?? "Import abgeschlossen.",
      });
    });
  }

  const requiredFieldsMapped = Object.values(mapping).includes("full_name");

  const previewRows = rawRows.slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Vorlage */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Muster-Vorlage</h2>
        <p className="mt-1 text-sm text-gray-500">
          Lädt eine Beispieldatei mit den korrekt benannten Spalten für den Import herunter.
        </p>
        <button
          onClick={downloadTemplate}
          className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Muster-Importvorlage herunterladen (.xlsx)
        </button>
      </section>

      {/* Export */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Daten exportieren</h2>
        <p className="mt-1 text-sm text-gray-500">
          Lädt alle aktuellen Datensätze als Excel-Datei (.xlsx) herunter.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleExportContacts}
            disabled={isExportingContacts}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isExportingContacts && <Spinner />}
            Kunden exportieren (.xlsx)
          </button>

          <button
            onClick={handleExportDeals}
            disabled={isExportingDeals}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isExportingDeals && <Spinner />}
            Deals exportieren (.xlsx)
          </button>
        </div>
      </section>

      {/* Import */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Daten importieren</h2>
        <p className="mt-1 text-sm text-gray-500">
          Unterstützt .xlsx und .csv. Für jeden Kontakt wird automatisch ein Deal angelegt, sofern
          noch keiner existiert — die Ziel-Pipeline wird über das Feld &quot;Deal&quot; bestimmt
          (z. B. &quot;Neukunde&quot; oder eine Pipeline-Bezeichnung wie &quot;Döner&quot;),
          andernfalls wird die Standard-Pipeline verwendet. Ein angegebenes Land wird in das
          Kontakt-Feld &quot;Land&quot; übernommen. Dubletten werden anhand der E-Mail-Adresse
          aktualisiert statt doppelt angelegt.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
            isDragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50"
          }`}
        >
          <p className="text-sm font-medium text-gray-700">
            Datei hierher ziehen oder klicken zum Auswählen
          </p>
          <p className="mt-1 text-xs text-gray-400">.xlsx, .xls oder .csv</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {fileName && headers.length > 0 && (
          <div className="mt-5 flex flex-col gap-4">
            <p className="text-sm font-medium text-gray-700">
              Datei: <span className="font-normal text-gray-500">{fileName}</span> ·{" "}
              {rawRows.length} Zeile(n) erkannt
            </p>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Spalten-Zuordnung
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Spalte in Datei
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Beispielwert
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Zuordnung
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {headers.map((header) => (
                      <tr key={header}>
                        <td className="px-3 py-2 font-medium text-gray-800">{header}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {String(rawRows[0]?.[header] ?? "")}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={mapping[header] ?? "ignore"}
                            onChange={(e) =>
                              setMapping((prev) => ({
                                ...prev,
                                [header]: e.target.value as TargetField,
                              }))
                            }
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                          >
                            {TARGET_FIELDS.map((field) => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Vorschau (erste {previewRows.length} Zeile{previewRows.length !== 1 ? "n" : ""})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-3 py-2 text-left font-medium text-gray-500">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {headers.map((header) => (
                          <td key={header} className="px-3 py-2 text-gray-700">
                            {String(row[header] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!requiredFieldsMapped && (
              <p className="text-xs text-amber-600">
                Bitte ordne mindestens das Feld Name zu, bevor du importierst.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={isImporting || !requiredFieldsMapped}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isImporting && <Spinner />}
                Daten importieren
              </button>
              <button
                onClick={resetImport}
                disabled={isImporting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Zurücksetzen
              </button>
            </div>

            {importResult && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                <p className="font-medium text-gray-800">{importResult.message}</p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-red-600">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}