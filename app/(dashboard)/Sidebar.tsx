'use client';

import { useEffect, useState } from 'react'
import ClientNav from './ClientNav'

const STORAGE_KEY = 'sidebar-collapsed'
const EXPANDED_WIDTH = 220
const COLLAPSED_WIDTH = 72

function IconChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Trägt die Sidebar UND den rechten Inhaltsbereich (Topbar + main) gemeinsam,
// damit beide dieselbe collapsed/expanded-Breite kennen — layout.tsx bleibt ein
// Server Component (Auth-Check), dieser Client Component übernimmt nur den
// Ein-/Ausklapp-Zustand inkl. localStorage-Persistenz.
export default function Sidebar({
  role,
  children,
}: {
  role: string
  children: React.ReactNode
}) {
  // Standardmäßig geöffnet (Punkt 1) — erst nach dem Mount ggf. aus
  // localStorage überschreiben, um einen SSR/Client-Mismatch zu vermeiden.
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') setCollapsed(true)
    } catch {
      // localStorage evtl. nicht verfügbar (Privatmodus etc.) — Standard bleibt offen.
    }
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignorieren — Zustand gilt dann nur für diese Sitzung
      }
      return next
    })
  }

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        style={{ width }}
        className="fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col justify-between border-r border-border bg-card py-4 transition-[width] duration-200 sm:flex"
      >
        <div className={`flex flex-col gap-6 ${collapsed ? 'items-center' : 'items-stretch px-3'}`}>
          <div className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between px-1'}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
              Y
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? 'Sidebar öffnen' : 'Sidebar minimieren'}
              className="ring-focus flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <IconChevron collapsed={collapsed} />
            </button>
          </div>

          <ClientNav collapsed={collapsed} />
        </div>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ${
            collapsed ? 'mx-auto' : 'ml-3'
          }`}
          title={role}
        >
          {role === 'Administrator' ? 'AD' : 'MA'}
        </div>
      </aside>

      <div
        className={`flex flex-1 flex-col transition-[padding] duration-200 ${
          collapsed ? 'sm:pl-[72px]' : 'sm:pl-[220px]'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
