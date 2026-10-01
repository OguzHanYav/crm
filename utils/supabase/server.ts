import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SESSION_ONLY_COOKIE, sessionOnlyOptions } from './session-cookie'

// sessionOnly überschreibt den Marker-Cookie (nur beim Login nötig, weil der
// Marker in derselben Anfrage gerade erst gesetzt/gelöscht wird).
export async function createClient(options?: { sessionOnly?: boolean }) {
  const cookieStore = await cookies()
  const sessionOnly = options?.sessionOnly ?? cookieStore.has(SESSION_ONLY_COOKIE)

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, sessionOnlyOptions(options, sessionOnly))
            )
          } catch {
            // Wird in Server Components aufgerufen, wo Cookies nicht
            // gesetzt werden können — die Middleware erneuert die Session.
          }
        },
      },
    }
  )
}