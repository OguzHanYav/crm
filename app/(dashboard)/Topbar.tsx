'use client';

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import SignOutButton from './sign-out-button'

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

const CTA_BY_ROUTE: { match: string; label: string; href: string }[] = [
  { match: '/dashboard/kontakte', label: 'Neuer Kontakt', href: '/dashboard/kontakte?new=1' },
  { match: '/dashboard/deals', label: 'Neuer Deal', href: '/dashboard/deals?new=1' },
  { match: '/dashboard/anrufe', label: 'Anruf protokollieren', href: '/dashboard/anrufe?new=1' },
]

export default function Topbar({
  displayName,
  role,
}: {
  displayName: string
  role: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (isCmdK) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/dashboard/kontakte?q=${encodeURIComponent(trimmed)}`)
  }

  const cta = CTA_BY_ROUTE.find((c) => pathname.startsWith(c.match))
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '—'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 px-6 backdrop-blur-md">
      <form onSubmit={handleSearchSubmit} className="mx-auto flex w-full max-w-md items-center">
        <div className="ring-focus flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-input px-3 text-sm text-muted-foreground transition-colors focus-within:border-accent/60">
          <IconSearch />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kontakte, Deals, Firmen durchsuchen…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </div>
      </form>

      <div className="flex shrink-0 items-center gap-3">
        {cta && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push(cta.href)}
          >
            <IconPlus />
            {cta.label}
          </Button>
        )}

        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {initials}
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="max-w-[140px] truncate text-xs font-medium text-foreground">
              {displayName}
            </span>
            <span className="text-[11px] text-muted-foreground">{role}</span>
          </div>
        </div>

        <SignOutButton />
      </div>
    </header>
  )
}
