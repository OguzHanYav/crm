'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactElement } from 'react'

function IconDashboard(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      {/* Dashboard-Kacheln: vier abgerundete Felder, vollständig innerhalb der 24er-viewBox */}
      <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
    </svg>
  )
}

function IconPipeline(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M3 5h18M3 12h18M3 19h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconContacts(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinejoin="round" />
    </svg>
  )
}

function IconCalls(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M5 4h3l1.5 4-2 1.5c1 2.5 2.5 4 5 5l1.5-2 4 1.5v3c0 1-1 1.5-2 1.5C9.5 18.5 5.5 14.5 4.5 8c-.1-1 .5-2 1.5-2z" strokeLinejoin="round" />
    </svg>
  )
}

function IconPhoneDevice(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" strokeLinejoin="round" />
      <path d="M10.5 18.5h3" strokeLinecap="round" />
    </svg>
  )
}

function IconFeatures(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="2.5" y="7" width="19" height="10" rx="5" strokeLinejoin="round" />
      <circle cx="16.5" cy="12" r="3" />
    </svg>
  )
}

function IconBuilding(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7h4M8 11h4M8 15h4" strokeLinecap="round" />
    </svg>
  )
}

function IconNotifications(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSettings(): ReactElement {
  return (
    <svg className="block h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" strokeLinejoin="round" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinejoin="round" />
    </svg>
  )
}

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/dashboard/deals', label: 'Pipelines', icon: IconPipeline },
  { href: '/dashboard/kontakte', label: 'Kontakte', icon: IconContacts },
  { href: '/dashboard/anrufe', label: 'Anrufe', icon: IconCalls },
  { href: '/dashboard/notifications', label: 'Benachrichtigungen', icon: IconNotifications },
  // Nur für Admins (ausgeblendet über ADMIN_ONLY_HREFS in lib/features.ts)
  { href: '/dashboard/phone', label: 'Telefon', icon: IconPhoneDevice },
  { href: '/dashboard/features', label: 'Features', icon: IconFeatures },
  // Nur für Super-Admins (ausgeblendet über SUPER_ADMIN_ONLY_HREFS in lib/features.ts)
  { href: '/dashboard/admin/tenants', label: 'Kundenverwaltung', icon: IconBuilding },
  // Immer letzter Menüpunkt
  { href: '/dashboard/settings', label: 'Einstellungen', icon: IconSettings },
]

function NavLink({
  href,
  label,
  icon: Icon,
  collapsed,
}: {
  href: string
  label: string
  icon: () => ReactElement
  collapsed: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname === href || (href === '/dashboard/deals' && pathname.startsWith('/dashboard/deals'))

  return (
    <Link
      href={href}
      className={`ring-focus flex h-11 items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
        collapsed ? 'w-11 justify-center' : 'w-full px-4 py-2.5'
      } ${
        isActive
          ? 'bg-accent-soft text-accent'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
      title={collapsed ? label : undefined}
    >
      {/* Fester Icon-Container: das SVG wird nie vom Text gestaucht oder beschnitten */}
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${collapsed ? '' : 'ml-1'}`}>
        <Icon />
      </span>
      {!collapsed && <span className="truncate text-sm font-medium">{label}</span>}
    </Link>
  )
}

export default function ClientNav({
  collapsed = true,
  hiddenHrefs = [],
}: {
  collapsed?: boolean
  hiddenHrefs?: string[]
}) {
  return (
    <nav className={`flex flex-col gap-1 ${collapsed ? 'items-center' : 'items-stretch'}`}>
      {navItems.filter((item) => !hiddenHrefs.includes(item.href)).map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} collapsed={collapsed} />
      ))}
    </nav>
  )
}
