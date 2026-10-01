import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_ONLY_COOKIE, isShortSessionExpired, sessionOnlyOptions } from '@/utils/supabase/session-cookie'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  // "Angemeldet bleiben" war beim Login aus -> Auth-Cookies bleiben Session-Cookies.
  const sessionMarker = request.cookies.get(SESSION_ONLY_COOKIE)?.value
  const sessionOnly = sessionMarker !== undefined

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, sessionOnlyOptions(options, sessionOnly))
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login')
  const isProtectedRoute = pathname === '/' || pathname.startsWith('/dashboard')

  // Fail-closed: schlägt die Session-Validierung selbst fehl (Netzwerkfehler,
  // Supabase down, kaputtes Cookie), wird das wie "kein User" behandelt statt
  // die Anfrage unauthentifiziert durchzulassen oder mit 500 abzubrechen.
  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (err) {
    console.error('proxy: getUser() failed, failing closed:', err)
  }

  // Kurze Sitzung abgelaufen -> abmelden (löscht die Auth-Cookies) und Marker entfernen.
  if (user && isShortSessionExpired(sessionMarker)) {
    await supabase.auth.signOut()
    supabaseResponse.cookies.delete(SESSION_ONLY_COOKIE)
    user = null
    if (isProtectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirect = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      redirect.cookies.delete(SESSION_ONLY_COOKIE)
      return redirect
    }
  }

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
