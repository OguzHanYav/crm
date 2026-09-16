import { createHmac, timingSafeEqual } from "crypto";
import { getNotificationsEnv } from "@/lib/config/env";

export type ResendWebhookEvent = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: { type: string; subType: string; message: string };
  };
};

// Svix (das Delivery-System hinter Resend-Webhooks) toleriert standardmäßig
// ±5 Minuten Uhrzeit-Abweichung — ein älterer Timestamp deutet auf einen
// wiederholten/aufgezeichneten Replay-Angriff hin, kein legitimer Retry.
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

// Kein svix-Package: es ist nur eine schlanke HMAC-Prüfung (Node "crypto" reicht
// vollständig aus), ein zusätzliches Package für 20 Zeilen Krypto-Code wäre eine
// unnötige Dependency (Supply-Chain-Fläche, Bundle-Größe) für etwas, das die
// Node-Standardbibliothek bereits kann.
export function verifyResendSignature(
  rawBody: string,
  headers: Headers
): { valid: boolean; error?: string } {
  const env = getNotificationsEnv();

  if (!env.RESEND_WEBHOOK_SECRET) {
    console.warn("Webhook-Secret nicht gesetzt — Signatur nicht validiert.");
    return { valid: true };
  }

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, error: "Fehlende Svix-Header." };
  }

  const timestampMs = Number(svixTimestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_AGE_MS) {
    return { valid: false, error: "Svix-Timestamp zu alt oder ungültig (Replay-Schutz)." };
  }

  // Secret-Format "whsec_<base64>" — der Teil nach dem ersten "_" ist
  // Base64-kodiert und muss vor dem HMAC dekodiert werden (Svix-Konvention).
  const secretWithoutPrefix = env.RESEND_WEBHOOK_SECRET.startsWith("whsec_")
    ? env.RESEND_WEBHOOK_SECRET.slice("whsec_".length)
    : env.RESEND_WEBHOOK_SECRET;
  const secretBytes = Buffer.from(secretWithoutPrefix, "base64");

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuffer = Buffer.from(expectedSignature, "base64");

  // svix-signature enthält mehrere durch Leerzeichen getrennte "v1,<base64>"
  // Einträge (z. B. bei Secret-Rotation) — es reicht, wenn EINER matcht.
  const candidates = svixSignature.split(" ");
  for (const candidate of candidates) {
    const [version, signature] = candidate.split(",");
    if (version !== "v1" || !signature) continue;

    let candidateBuffer: Buffer;
    try {
      candidateBuffer = Buffer.from(signature, "base64");
    } catch {
      continue;
    }

    if (candidateBuffer.length !== expectedBuffer.length) continue;
    if (timingSafeEqual(candidateBuffer, expectedBuffer)) {
      return { valid: true };
    }
  }

  return { valid: false, error: "Signatur ungültig." };
}
