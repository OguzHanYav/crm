'use client'

import { useActionState, useState } from 'react'
import { signIn } from './actions'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, {
    error: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [lang, setLang] = useState<'de' | 'en'>('de')

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F1115] p-6">
      {/* Wellen-Hintergrund */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 500 C 200 400, 400 600, 600 500 S 1000 400, 1200 500 S 1500 600, 1600 500"
          stroke="white"
          strokeWidth="1.5"
        />
        <path
          d="M0 650 C 250 550, 450 750, 650 650 S 1050 550, 1250 650 S 1500 750, 1600 650"
          stroke="white"
          strokeWidth="1.5"
        />
        <path
          d="M0 320 C 220 220, 420 420, 620 320 S 1020 220, 1220 320 S 1500 420, 1600 320"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

      {/* Card */}
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#1E2026] p-10 shadow-2xl">
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">OY LeadFlow</h1>

        <form action={formAction} className="mt-8 flex flex-col gap-3">
          <div className="relative">
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="E-Mail"
              className="h-12 w-full rounded-lg border border-white/10 bg-[#2A2D35] pl-4 pr-11 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/30"
            />
            <svg
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
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
              className="h-12 w-full rounded-lg border border-white/10 bg-[#2A2D35] pl-4 pr-11 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
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
            <label htmlFor="login-remember" className="flex items-center gap-2 text-white/60">
              <input
                id="login-remember"
                name="remember"
                type="checkbox"
                autoComplete="off"
                defaultChecked
                className="h-4 w-4 rounded border-white/20 bg-[#2A2D35] accent-white"
              />
              Angemeldet bleiben
            </label>
            <a href="#" className="text-white/60 transition-colors hover:text-white">
              Passwort vergessen?
            </a>
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 h-12 w-full rounded-lg bg-white text-sm font-semibold text-[#0F1115] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          Powered by{' '}
          <a
            href="https://oguzhan-yavuz.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 underline underline-offset-2 hover:text-white"
          >
            oguzhan-yavuz.com
          </a>
        </p>

        <div className="mt-6 flex justify-center">
          <div className="flex overflow-hidden rounded-full border border-white/10 text-xs text-white/50">
            <button
              type="button"
              onClick={() => setLang('de')}
              className={`px-3 py-1.5 transition-colors ${lang === 'de' ? 'bg-white/10 text-white' : 'hover:text-white/80'}`}
            >
              Deutsch
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 transition-colors ${lang === 'en' ? 'bg-white/10 text-white' : 'hover:text-white/80'}`}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
