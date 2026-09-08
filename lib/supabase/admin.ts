import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export function hasServiceRoleConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Nur für Operationen, die zwingend die Supabase Admin-API brauchen (auth.admin.*) —
// dafür gibt es keinen Fallback, da normale Sessions diese API nicht aufrufen dürfen.
// Wirft einen abgefangenen, klar formulierten Fehler statt die Seite abstürzen zu lassen.
export function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Diese Aktion erfordert den Supabase Service-Role-Key (SUPABASE_SERVICE_ROLE_KEY). Bitte in den Umgebungsvariablen konfigurieren."
    );
  }

  return createServiceRoleClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Für reine `profiles`-Mutationen: nutzt den Service-Role-Client (umgeht RLS), fällt
// aber — falls der Service-Role-Key im Environment fehlt — auf den regulären,
// session-gebundenen Server/Anon-Client zurück, statt den Admin mit einem
// Konfigurationsfehler zu blockieren. Greift dann unter der RLS-Session des
// eingeloggten Admins.
export async function getAdminOrFallbackClient() {
  if (hasServiceRoleConfig()) {
    return getServiceRoleClient();
  }
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY fehlt — falle für Profil-Mutationen auf den Standard-Server-Client zurück."
  );
  return createServerClient();
}
