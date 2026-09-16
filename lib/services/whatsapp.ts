import { getNotificationsEnv } from "@/lib/config/env";
import { withRetry, RetryableStatusError } from "./retry";

const GRAPH_API_VERSION = "v21.0";

export type WhatsAppTemplateComponent = {
  type: "header" | "body" | "button";
  parameters?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  sub_type?: string;
  index?: number;
};

export type SendWhatsAppTemplateInput = {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
};

export type SendWhatsAppTemplateResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

// Erwartet lose Eingaben (Leerzeichen, Klammern, Bindestriche, führende "00")
// und normalisiert strikt auf E.164 ("+" + Ländercode + Nummer, nur Ziffern).
// Bricht ohne erkennbaren Ländercode ab, statt eine vermutlich falsche Nummer
// an die Graph API zu senden.
export function normalizePhoneToE164(rawPhone: string): { success: true; phone: string } | { success: false; error: string } {
  if (!rawPhone || !rawPhone.trim()) {
    return { success: false, error: "Telefonnummer fehlt." };
  }

  let cleaned = rawPhone.trim().replace(/[\s\-().]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (!cleaned.startsWith("+")) {
    // Ohne "+" und ohne "00"-Präfix ist der Ländercode nicht zuverlässig erkennbar
    // (z. B. "0176..." ist eine deutsche Inlandsnummer, aber auch andere Länder
    // nutzen führende Nullen) — lieber abbrechen als eine falsche Nummer annehmen.
    return {
      success: false,
      error: `Telefonnummer "${rawPhone}" hat keinen erkennbaren Ländercode (erwartet "+" oder "00" Präfix).`,
    };
  }

  const digits = cleaned.slice(1);
  if (!/^\d{8,15}$/.test(digits)) {
    return {
      success: false,
      error: `Telefonnummer "${rawPhone}" entspricht nicht dem E.164-Format (+ und 8–15 Ziffern erwartet).`,
    };
  }

  return { success: true, phone: `+${digits}` };
}

export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "de",
  components,
}: SendWhatsAppTemplateInput): Promise<SendWhatsAppTemplateResult> {
  const normalized = normalizePhoneToE164(to);
  if (!normalized.success) {
    return { success: false, error: normalized.error };
  }

  try {
    const env = getNotificationsEnv();
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: normalized.phone.replace("+", ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length > 0 ? { components } : {}),
      },
    };

    const result = await withRetry(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = json?.error?.message ?? `WhatsApp API Fehler (HTTP ${response.status}).`;
        throw new RetryableStatusError(response.status, message);
      }

      return json;
    });

    const messageId = result?.messages?.[0]?.id as string | undefined;
    return { success: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler beim WhatsApp-Versand.";
    console.error("sendWhatsAppTemplate error:", message);
    return { success: false, error: message };
  }
}
