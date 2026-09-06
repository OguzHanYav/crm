'use client'

import { useActionState } from 'react'
import { signIn } from './actions'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, {
    error: '',
  })

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Formular */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-lg font-semibold tracking-tight text-foreground lg:hidden">
            Yavuz CRM
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Anmelden</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Melde dich mit deinen Zugangsdaten an.
          </p>

          <form action={formAction} className="mt-8 flex flex-col gap-4">
            <div>
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@firma.de"
              />
            </div>

            <div>
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {state.error && (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="mt-2 w-full">
              {isPending ? 'Anmelden …' : 'Anmelden'}
            </Button>
          </form>
        </div>
      </div>

      {/* Visual */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex bg-[linear-gradient(160deg,var(--accent)_0%,#0F172A_75%)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

        <div className="relative text-lg font-semibold tracking-tight">Yavuz CRM</div>

        <div className="relative max-w-sm">
          <p className="text-3xl font-medium leading-snug">
            CRM &amp; Lead Management für dein ganzes Team.
          </p>
          <p className="mt-4 text-sm text-white/70">
            Jeden Lead vom ersten Anruf bis zum Abschluss im Blick behalten — Setter, Closer und
            Pipeline an einem Ort.
          </p>

          <ul className="mt-8 flex flex-col gap-3 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" /> Kontakte &amp; Deals zentral verwalten
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" /> Pipeline-Phasen auf einen Blick
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" /> Anrufe &amp; Notizen lückenlos protokolliert
            </li>
          </ul>
        </div>

        <div className="relative text-sm text-white/50">© {new Date().getFullYear()}</div>
      </div>
    </div>
  )
}
