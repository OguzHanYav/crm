#!/usr/bin/env node
// Ruft die letzten Function-Logs eines Vercel-Deployments per `vercel logs --json`
// ab, filtert auf console.time/console.timeEnd-Zeilen mit dem Präfix "[perf]"
// (siehe kontakte/data.ts, kontakte/actions.ts, app/api/contacts/route.ts) und
// gibt sie als Tabelle aus.
//
// Getestet gegen Vercel CLI 59.11.2 — Feldnamen im JSON-Output
// (id, timestamp, requestPath, responseStatusCode, logs[].message, ...) stammen
// aus einem echten `vercel logs --json`-Abruf gegen dieses Projekt. Bei einer
// stark abweichenden CLI-Version ggf. mit `vercel logs --json | head -1` prüfen,
// ob sich das Schema geändert hat.
//
// Installation:
//   npm install -g vercel        # falls noch nicht vorhanden
//   vercel login                 # einmalig
//   vercel link                  # einmalig, verknüpft dieses Repo mit dem Projekt
//
// Ausführung:
//   node scripts/get-performance-logs.js
//   node scripts/get-performance-logs.js --project crm --limit 100
//   node scripts/get-performance-logs.js --environment production

const { execFileSync } = require("node:child_process");

function parseArgs(argv) {
  const args = { limit: "100", project: undefined, environment: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--limit" || arg === "-n") args.limit = argv[++i];
    else if (arg === "--project" || arg === "-p") args.project = argv[++i];
    else if (arg === "--environment") args.environment = argv[++i];
  }
  return args;
}

function fetchLogs({ limit, project, environment }) {
  const cliArgs = ["logs", "--limit", String(limit), "--json"];
  if (project) cliArgs.push("--project", project);
  if (environment) cliArgs.push("--environment", environment);

  let raw;
  try {
    raw = execFileSync("vercel", cliArgs, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  } catch (err) {
    console.error("Fehler beim Aufruf von `vercel logs` — ist die Vercel CLI installiert und eingeloggt?");
    console.error("Installation: npm install -g vercel && vercel login && vercel link");
    console.error(err.stderr?.toString?.() ?? err.message);
    process.exit(1);
  }

  // `vercel logs --json` gibt JSON Lines aus, gemischt mit ein paar Status-
  // Textzeilen ("Fetching project ...") — nicht-JSON-Zeilen werden übersprungen.
  const lines = raw.split("\n").filter(Boolean);
  const entries = [];
  const seenIds = new Set();

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.id && seenIds.has(entry.id)) continue;
    if (entry.id) seenIds.add(entry.id);
    entries.push(entry);
  }
  return entries;
}

// Extrahiert alle "[perf] ..."-Zeilen aus dem verschachtelten `logs`-Array
// jedes Request-Log-Eintrags (ein Request kann mehrere console.time-Aufrufe
// enthalten, z. B. getContacts + getContactsTotalCount im selben Request).
function extractPerfRows(entries) {
  const rows = [];
  for (const entry of entries) {
    const nestedLogs = Array.isArray(entry.logs) && entry.logs.length > 0 ? entry.logs : [entry];
    for (const log of nestedLogs) {
      const message = log.message || "";
      if (!message.includes("[perf]")) continue;

      // Format: "[perf] <label>: <dauer>ms" (console.timeEnd-Ausgabe)
      const match = message.match(/\[perf\]\s*(.+?):\s*([\d.]+)\s*ms/);
      rows.push({
        timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : "",
        path: entry.requestPath || "",
        status: entry.responseStatusCode ?? "",
        label: match ? match[1].trim() : message.replace("[perf]", "").trim(),
        durationMs: match ? Number(match[2]) : null,
      });
    }
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = fetchLogs(args);
  const rows = extractPerfRows(entries);

  if (rows.length === 0) {
    console.log(
      `Keine [perf]-Logs in den letzten ${args.limit} Einträgen gefunden. ` +
        `Entweder gab es in diesem Zeitfenster keine passenden Requests, oder die Logs sind älter — mit --limit erhöhen.`
    );
    return;
  }

  // Neueste zuerst.
  rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  console.table(
    rows.map((r) => ({
      Zeit: r.timestamp,
      Pfad: r.path,
      Status: r.status,
      Query: r.label,
      "Dauer (ms)": r.durationMs ?? "—",
    }))
  );

  const durations = rows.map((r) => r.durationMs).filter((d) => typeof d === "number");
  if (durations.length > 0) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    console.log(
      `\n${durations.length} [perf]-Messungen — Ø ${avg.toFixed(1)}ms, max ${max.toFixed(1)}ms.`
    );
  }
}

main();
