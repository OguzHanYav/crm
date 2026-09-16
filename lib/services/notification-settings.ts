import { getServiceRoleClient } from "@/lib/supabase/admin";
import { getNotificationsEnv } from "@/lib/config/env";

export type NotificationSettings = {
  from: { email: string; name?: string };
  replyTo: string;
  resendApiKey: string | null;
};

const CACHE_TTL_MS = 60 * 1000;

// In-Memory-Cache (Modul-Variable) statt bei jedem Versand neu aus der DB zu
// lesen — notification_settings ändert sich nur, wenn jemand manuell per SQL
// UPDATE eingreift (siehe Kommentar unten), ein 60s-Cache ist dafür großzügig
// genug, ohne bei einem Kundenwechsel stundenlang veraltete Werte zu zeigen.
let cache: { value: NotificationSettings; fetchedAt: number } | null = null;

// Der Kunde überschreibt seine eigenen Werte später per:
//   UPDATE notification_settings
//   SET from_email = 'office@kunden-domain.de',
//       from_name = 'Kundenfirma',
//       reply_to_email = 'office@kunden-domain.de',
//       resend_api_key = 're_KUNDEN_KEY',
//       updated_at = now()
//   WHERE key = 'default';
// Danach greift die neue Konfiguration spätestens nach Ablauf des 60s-Caches.
export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const value = await loadFromDbOrFallback();
  cache = { value, fetchedAt: Date.now() };
  return value;
}

function fallbackSettings(): NotificationSettings {
  const env = getNotificationsEnv();
  return {
    from: { email: env.RESEND_FROM_EMAIL ?? "" },
    replyTo: env.RESEND_REPLY_TO ?? env.RESEND_FROM_EMAIL ?? "",
    resendApiKey: null,
  };
}

async function loadFromDbOrFallback(): Promise<NotificationSettings> {
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

    if (!data) {
      return fallbackSettings();
    }

    const env = getNotificationsEnv();
    return {
      from: {
        email: data.from_email ?? env.RESEND_FROM_EMAIL ?? "",
        name: data.from_name ?? undefined,
      },
      replyTo: data.reply_to_email ?? env.RESEND_REPLY_TO ?? env.RESEND_FROM_EMAIL ?? "",
      resendApiKey: data.resend_api_key ?? null,
    };
  } catch (err) {
    console.error("getNotificationSettings unexpected error:", err);
    return fallbackSettings();
  }
}
