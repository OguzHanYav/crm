'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { navItems } from './ClientNav'

export default function MobileSidebar({ hiddenNavHrefs = [] }: { hiddenNavHrefs?: string[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Hintergrund-Scrollen sperren, solange das Menü offen ist.
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Menü öffnen"
        className="ring-focus flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground sm:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>

      {/* Per Portal direkt in <body>: Der Button sitzt im Topbar-<header> mit
          backdrop-blur — backdrop-filter macht den Header zum Bezugsrahmen für
          position:fixed, wodurch Drawer und Overlay sonst auf die 64px-Höhe des
          Headers beschränkt wären und die Menüeinträge transparent über den
          Seiteninhalt ragten. */}
      {isOpen &&
        createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col sm:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="mobile-sheet-in relative flex h-auto max-h-[85dvh] w-full max-w-full flex-col overflow-y-auto rounded-b-2xl border-b border-border bg-card px-3 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-xl sm:max-w-xs">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                Y
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Menü schließen"
                className="ring-focus flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.filter((item) => !hiddenNavHrefs.includes(item.href)).map((item) => {
                const isActive =
                  pathname === item.href || (item.href === '/dashboard/deals' && pathname.startsWith('/dashboard/deals'))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`ring-focus flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-3 text-base font-medium leading-none transition-colors ${
                      isActive
                        ? 'bg-accent-soft text-accent'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <Icon />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>,
          document.body
        )}
    </>
  )
}
