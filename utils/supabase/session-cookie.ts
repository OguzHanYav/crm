// "Angemeldet bleiben" deaktiviert -> kurze Sitzung:
// - Die Supabase-Auth-Cookies werden als Session-Cookies gesetzt (ohne
//   maxAge/expires) und verschwinden beim Schließen des Browsers.
// - Zusätzlich endet die Sitzung spätestens nach SHORT_SESSION_HOURS.
// Der Marker-Cookie enthält den Ablaufzeitpunkt (Unix-ms) und ist selbst ein
// Session-Cookie. Fehlt er, gilt die normale, persistente Supabase-Session.
export const SESSION_ONLY_COOKIE = 'sb-session-only'
export const SHORT_SESSION_HOURS = 12

type CookieOptions = { maxAge?: number; expires?: Date | string | number; [key: string]: unknown }

export function sessionOnlyOptions<T extends CookieOptions>(options: T | undefined, sessionOnly: boolean): T {
  if (!sessionOnly || !options) return (options ?? {}) as T
  // Gelöschte Cookies (maxAge 0) unverändert lassen, sonst würde Abmelden nicht greifen.
  if (options.maxAge === 0) return options
  const { maxAge: _maxAge, expires: _expires, ...rest } = options
  return rest as T
}

export function isShortSessionExpired(markerValue: string | undefined): boolean {
  if (!markerValue) return false
  const expiresAt = Number(markerValue)
  return Number.isFinite(expiresAt) && Date.now() > expiresAt
}
