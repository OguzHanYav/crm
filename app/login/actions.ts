'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { SESSION_ONLY_COOKIE, SHORT_SESSION_HOURS } from '@/utils/supabase/session-cookie'

export async function signIn(
  _prevState: { error: string | null },
  formData: FormData
) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Bitte E-Mail und Passwort eingeben.' }
  }

  // "Angemeldet bleiben": persistente Session (Supabase-Standard). Sonst kurze
  // Sitzung über Session-Cookies + Ablauf nach SHORT_SESSION_HOURS (siehe
  // utils/supabase/session-cookie.ts und proxy.ts).
  const remember = formData.get('remember') === 'on'

  const supabase = await createClient({ sessionOnly: !remember })
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'E-Mail oder Passwort ist falsch.' }
  }

  const cookieStore = await cookies()
  if (remember) {
    cookieStore.delete(SESSION_ONLY_COOKIE)
  } else {
    cookieStore.set(SESSION_ONLY_COOKIE, String(Date.now() + SHORT_SESSION_HOURS * 60 * 60 * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
  }

  redirect('/dashboard')
}
