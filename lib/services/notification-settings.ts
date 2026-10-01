import { getServiceRoleClient } from "@/lib/supabase/admin";
import { getNotificationsEnv } from "@/lib/config/env";
import type { EmailTransport } from "@/lib/services/email";

export type NotificationSettings = {
  // false = für diesen Mandanten ist kein Absender eingerichtet -> nicht senden.
  configured: boolean;
  from: { email: string; name?: string };
  replyTo: string;
  resendApiKey: string | null;
  transport: EmailTransport;
  // Klartext-Grund, wenn configured = false (wird als Fehler protokolliert)
  reason?: string;
};

const CACHE_TTL_MS = 60 * 1000;

// Pro Mandant gecacht (60 s), damit nicht jeder Versand die DB liest.
const cache = new Map<string, { value: NotificationSettings; fetchedAt: number }>();

export const MISSING_SENDER_MESSAGE =
  "Für diesen Kunden ist kein E-Mail-Absender eingerichtet (Einstellungen → E-Mail-Absender).";

// Absender für einen Mandanten:
//  1. tenant_email_settings des Mandanten (eigenes SMTP oder eigener Resend-Key)
//  2. nur für den Standard-Mandanten (Betreiber) bzw. ohne Mandanten-Schema:
//     bisherige globale notification_settings / Umgebungsvariablen
//  3. sonst: nicht konfiguriert -> Versand wird abgelehnt. So geht nie eine
//     Kunden-Mail über den Absender des Betreibers raus.
export async function getNotificationSettings(tenantId: string | null = null): Promise<NotificationSettings> {
  const key = tenantId ?? "__global__";
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.value;

  const value = tenantId ? await loadForTenant(tenantId) : await loadGlobal();
  cache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

export function invalidateNotificationSettings(tenantId: string | null) {
  cache.delete(tenantId ?? "__global__");
}

async function loadForTenant(tenantId: string): Promise<NotificationSettings> {
  const admin = getServiceRoleClient();
  const [{ data: settings, error }, { data: tenant }] = await Promise.all([
    admin
      .from("tenant_email_settings")
      .select("from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_user, smtp_password, api_key")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin.from("tenants").select("name, is_default").eq("id", tenantId).maybeSingle(),
  ]);
  if (error && !/tenant_email_settings/.test(error.message)) {
    console.error("getNotificationSettings tenant error:", error.message);
  }

  if (settings?.from_email && (settings.smtp_host || settings.api_key || tenant?.is_default)) {
    return {
      configured: true,
      from: { email: settings.from_email, name: settings.from_name ?? tenant?.name ?? undefined },
      replyTo: settings.reply_to_email || settings.from_email,
      resendApiKey: settings.api_key ?? null,
      transport: {
        smtp: settings.smtp_host
          ? {
              host: settings.smtp_host,
              port: settings.smtp_port ?? 587,
              user: settings.smtp_user ?? null,
              password: settings.smtp_password ?? null,
            }
          : null,
        resendApiKey: settings.api_key ?? null,
      },
    };
  }

  // Betreiber selbst: bisherige globale Konfiguration weiter nutzen.
  if (tenant?.is_default) return loadGlobal();

  return {
    configured: false,
    from: { email: "", name: tenant?.name ?? undefined },
    replyTo: "",
    resendApiKey: null,
    transport: {},
    reason: MISSING_SENDER_MESSAGE,
  };
}

function fallbackSettings(): NotificationSettings {
  const env = getNotificationsEnv();
  return {
    configured: Boolean(env.RESEND_FROM_EMAIL),
    from: { email: env.RESEND_FROM_EMAIL ?? "" },
    replyTo: env.RESEND_REPLY_TO ?? env.RESEND_FROM_EMAIL ?? "",
    resendApiKey: null,
    transport: {},
  };
}

// Globale Absender-Konfiguration (Tabelle notification_settings, key = 'default').
async function loadGlobal(): Promise<NotificationSettings> {
  try {
    const admin = getServiceRoleClient();
    const { data, error } = await admin
      .from("notification_settings")
      .select("from_email, from_name, reply_to_email, resend_api_key")
      .eq("key", "default")
      .maybeSingle();

    if (error) {
      console.error("getNotificationSettings error:", error.message);
      return fallbackSettings();
    }
    if (!data) return fallbackSettings();

    const env = getNotificationsEnv();
    return {
      configured: true,
      from: {
        email: data.from_email ?? env.RESEND_FROM_EMAIL ?? "",
        name: data.from_name ?? undefined,
      },
      replyTo: data.reply_to_email ?? env.RESEND_REPLY_TO ?? env.RESEND_FROM_EMAIL ?? "",
      resendApiKey: data.resend_api_key ?? null,
      transport: { resendApiKey: data.resend_api_key ?? null },
    };
  } catch (err) {
    console.error("getNotificationSettings unexpected error:", err);
    return fallbackSettings();
  }
}
