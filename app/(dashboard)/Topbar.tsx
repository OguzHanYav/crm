'use client';

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const CTA_BY_ROUTE: { match: string; label: string; href: string }[] = [
  { match: '/dashboard/anrufe', label: 'Anruf protokollieren', href: '/dashboard/anrufe?new=1' },
]

const USER_MENU_LINKS = [
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/deals', label: 'Pipeline' },
  { href: '/dashboard', label: 'Dashboard' },
]

function UserMenu({ displayName, role, initials }: { displayName: string; role: string; initials: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="ring-focus flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 transition-colors hover:bg-muted/50"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initials}
        </div>
        <div className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-[140px] truncate text-xs font-medium text-foreground">
            {displayName}
          </span>
          <span className="text-[11px] text-muted-foreground">{role}</span>
        </div>
        <IconChevron open={isOpen} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg">
          {USER_MENU_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="ring-focus flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-muted/60"
            >
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-border" />
          <SignOutButton />
        </div>
      )}
    </div>
  )
}

export default function Topbar({
  displayName,
  role,
  mobileNav,
}: {
  displayName: string
  role: string
  mobileNav?: React.ReactNode
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md sm:gap-4 sm:px-6">
      {mobileNav}
      <form onSubmit={handleSearchSubmit} className="mx-auto flex w-full max-w-md items-center">
        <div className="ring-focus flex h-11 min-h-[44px] w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors focus-within:border-accent/60">
          <IconSearch />
          <input
            id="global-search"
            name="globalSearch"
            autoComplete="off"
            aria-label="Kontakte, Deals, Firmen durchsuchen"
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
          <button
            onClick={() => router.push(cta.href)}
            className="ring-focus flex min-h-[44px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:brightness-110"
          >
            <IconPlus />
            <span className="hidden sm:inline">{cta.label}</span>
          </button>
        )}

        <UserMenu displayName={displayName} role={role} initials={initials} />
      </div>
    </header>
  )
}
