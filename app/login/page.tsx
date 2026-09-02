'use client'

import { useActionState } from 'react'
import { signIn } from './actions'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, {
    error: '',  // ← String, nicht null!
  })

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div className="text-lg font-semibold tracking-tight">
          Yavuz CRM
        </div>
        <div className="max-w-sm">
          <p className="text-2xl font-medium leading-snug">
            Jeden Lead vom ersten Anruf bis zum Abschluss im Blick behalten.
          </p>
          <p className="mt-4 text-sm text-white/60">
            Setter, Closer und Pipeline an einem Ort.
          </p>
        </div>
        <div className="text-sm text-white/40">© {new Date().getFullYear()}</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-ink">Anmelden</h1>
          <p className="mt-1 text-sm text-muted">
            Melde dich mit deinen Zugangsdaten an.
          </p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink"
              >
                E-Mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="name@firma.de"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-ink"
              >
                Passwort
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
              />
            </div>

            {state.error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-ink disabled:opacity-60"
            >
              {isPending ? 'Anmelden …' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}