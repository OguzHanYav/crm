'use client'

import { useActionState, useEffect, useState } from 'react'
import { signIn } from './actions'
import Logo from '@/components/Logo'

const REMEMBERED_EMAIL_KEY = 'remembered_email'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, {
    error: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [remember, setRemember] = useState(true)

  // Gemerkte E-Mail ("Angemeldet bleiben") beim Öffnen vorausfüllen.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY)
      if (saved) {
        setEmail(saved)
        setRemember(true)
      }
    } catch {
      // localStorage nicht verfügbar (z. B. Privatmodus) — Feld bleibt leer.
    }
  }, [])

  function handleSubmit() {
    try {
      if (remember && email.trim()) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY)
    } catch {
      // ignorieren
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-zinc-950 sm:p-6">
      {/* Dezentes Punkt-Muster + weicher blauer Verlauf */}
      <div
        className="pointer-events-none absolute inset-0 text-slate-300/70 dark:text-zinc-800"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/15 blur-3xl dark:bg-blue-500/10" />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo variant="full" />
          <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">Melde dich mit deinem Konto an.</p>
        </div>

        <form action={formAction} onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <div className="relative">
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail"
              className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <svg
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M6 16c.6-1.6 2-2.5 3-2.5s2.4.9 3 2.5" strokeLinecap="round" />
              <path d="M14 9h4M14 12h4" strokeLinecap="round" />
            </svg>
          </div>

          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Passwort"
              className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
                {showPassword ? (
                  <path
                    d="M3 3l18 18M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5M6.5 6.7C4.3 8.1 2.7 10 2 12c1.5 3.9 5.5 7 10 7 1.6 0 3.1-.4 4.4-1.1M9.9 4.2A10.8 10.8 0 0 1 12 4c4.5 0 8.5 3.1 10 7-.5 1.2-1.2 2.4-2.1 3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <>
                    <path
                      d="M2 12c1.5-3.9 5.5-7 10-7s8.5 3.1 10 7c-1.5 3.9-5.5 7-10 7s-8.5-3.1-10-7Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="2.5" />
                  </>
                )}
              </svg>
            </button>
          </div>

          <div className="mt-1 flex items-center justify-between text-sm">
            <label htmlFor="login-remember" className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
              <input
                id="login-remember"
                name="remember"
                type="checkbox"
                autoComplete="off"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600 dark:border-zinc-600"
              />
              Angemeldet bleiben
            </label>
            <a href="/auth/reset-password" className="font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Passwort vergessen?
            </a>
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 h-12 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-zinc-900"
          >
            {isPending ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-zinc-500">
          Powered by{' '}
          <a
            href="https://oguzhan-yavuz.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            oguzhan-yavuz.com
          </a>
        </p>
      </div>
    </div>
  )
}
