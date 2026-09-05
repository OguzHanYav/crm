'use client';

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ReactElement } from 'react'

function IconDashboard(): ReactElement {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M3 12h4v9H3zM12 3h4v18h-4zM21 8h4v13h-4z" strokeLinejoin="round" />
    </svg>
  )
}

function IconPipeline(): ReactElement {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M3 5h18M3 12h18M3 19h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconContacts(): ReactElement {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinejoin="round" />
    </svg>
  )
}

function IconCalls(): ReactElement {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M5 4h3l1.5 4-2 1.5c1 2.5 2.5 4 5 5l1.5-2 4 1.5v3c0 1-1 1.5-2 1.5C9.5 18.5 5.5 14.5 4.5 8c-.1-1 .5-2 1.5-2z" strokeLinejoin="round" />
    </svg>
  )
}

function IconSettings(): ReactElement {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" strokeLinejoin="round" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinejoin="round" />
    </svg>
  )
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/dashboard/deals', label: 'Pipelines', icon: IconPipeline },
  { href: '/dashboard/kontakte', label: 'Kontakte', icon: IconContacts },
  { href: '/dashboard/anrufe', label: 'Anrufe', icon: IconCalls },
  { href: '/dashboard/settings', label: 'Einstellungen', icon: IconSettings },
]

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: () => ReactElement }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isActive = pathname === href || (href === '/dashboard/deals' && pathname.startsWith('/dashboard/deals'))

  return (
    <Link
      href={href}
      className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
      }`}
      title={label}
    >
      <Icon />
    </Link>
  )
}

export default function ClientNav() {
  return (
    <nav className="flex flex-col items-center gap-1">
      {navItems.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
      ))}
    </nav>
  )
}
