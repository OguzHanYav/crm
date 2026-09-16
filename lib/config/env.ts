import { z } from "zod";

// RESEND_FROM_EMAIL/RESEND_REPLY_TO sind NUR Fallback: die eigentliche Absender-
// konfiguration kommt jetzt primär aus der Tabelle notification_settings (siehe
// lib/services/notification-settings.ts), damit sie sich pro Kunde per UPDATE
// ändern lässt, ohne Redeploy. Beide bleiben hier optional, weil ein fehlender
// DB-Eintrag sonst die gesamte Notifications-Konfiguration zum Absturz bringen
// würde, obwohl die DB längst einen gültigen Absender liefern könnte.
const notificationsEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY fehlt."),
  RESEND_FROM_EMAIL: z.string().email("RESEND_FROM_EMAIL muss eine gültige E-Mail-Adresse sein.").optional(),
  RESEND_REPLY_TO: z.string().email("RESEND_REPLY_TO muss eine gültige E-Mail-Adresse sein.").optional(),
  // Der Webhook (app/api/webhooks/resend/route.ts) funktioniert auch OHNE dieses
  // Secret (dann unsigniert, mit Konsolenwarnung) — mit Secret wird die
  // Svix-Signatur validiert, siehe lib/services/resend-webhook.ts. In
  // Produktion ist das Secret Pflicht, um gefälschte Bounce-Events zu verhindern.
  RESEND_WEBHOOK_SECRET: z.string().min(1, "RESEND_WEBHOOK_SECRET darf nicht leer sein.").optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1, "WHATSAPP_PHONE_NUMBER_ID fehlt."),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1, "WHATSAPP_ACCESS_TOKEN fehlt."),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1, "WHATSAPP_BUSINESS_ACCOUNT_ID fehlt."),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL muss eine gültige URL sein."),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY fehlt."),
});

export type NotificationsEnv = z.infer<typeof notificationsEnvSchema>;

let cached: NotificationsEnv | null = null;

// Lazy statt eager validiert: wird erst beim ersten tatsächlichen Versand
// (email.ts/whatsapp.ts) geparst, damit Seiten, die diese Kanäle nicht nutzen,
// nicht durch fehlende Notifications-Env-Vars zum Absturz gebracht werden.
export function getNotificationsEnv(): NotificationsEnv {
  if (cached) return cached;

  const parsed = notificationsEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join(" ");
    throw new Error(`Notifications-Konfiguration ungültig: ${issues}`);
  }

  cached = parsed.data;
  return cached;
}
