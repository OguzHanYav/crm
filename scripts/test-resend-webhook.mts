// Nur für lokale Entwicklung, NICHT für Production. Sendet einen gefälschten
// Resend-Bounce-Event an den lokalen Dev-Server, um app/api/webhooks/resend/
// route.ts end-to-end zu testen (inkl. Svix-Signatur, falls RESEND_WEBHOOK_SECRET
// in .env.local gesetzt ist).
//
// Aufruf: npx tsx scripts/test-resend-webhook.ts
// Voraussetzung: `npm run dev` läuft bereits auf Port 3000.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHmac, randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env: Record<string, string> = {};
  let content: string;
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    return env;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const secret = env.RESEND_WEBHOOK_SECRET;
const targetUrl = "http://localhost:3000/api/webhooks/resend";

const payload = {
  type: "email.bounced",
  created_at: new Date().toISOString(),
  data: {
    email_id: `mock_${randomUUID()}`,
    from: "office@crm.oguzhan-yavuz.com",
    to: ["bounce-test-xyz@deine-test-domain.invalid"],
    subject: "Mock Bounce Test",
    bounce: { type: "Permanent", subType: "General", message: "Mock bounce for local testing" },
  },
};

const rawBody = JSON.stringify(payload);
const svixId = `msg_${randomUUID()}`;
const svixTimestamp = Math.floor(Date.now() / 1000).toString();

const headers: Record<string, string> = { "Content-Type": "application/json" };

if (secret) {
  const secretWithoutPrefix = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const secretBytes = Buffer.from(secretWithoutPrefix, "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signature = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  headers["svix-id"] = svixId;
  headers["svix-timestamp"] = svixTimestamp;
  headers["svix-signature"] = `v1,${signature}`;
} else {
  console.warn("RESEND_WEBHOOK_SECRET nicht in .env.local gesetzt — sende unsignierten Request.");
}

const response = await fetch(targetUrl, { method: "POST", headers, body: rawBody });
const text = await response.text();

console.log(`Status: ${response.status}`);
console.log(`Body: ${text}`);
