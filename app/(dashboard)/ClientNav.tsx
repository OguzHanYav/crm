'use client';

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const navItems = [
  {
    category: 'VERTRIEB',
    items: [
      { href: '/dashboard/kontakte', label: 'Kontakte' },
      {
        href: '/dashboard/deals',
        label: 'Pipelines',
        subItems: [
          { href: '/dashboard/deals?pipeline=setter-closer', label: 'Setter / Closer' },
          { href: '/dashboard/deals?pipeline=upsell', label: 'Upsell' },
          { href: '/dashboard/deals?pipeline=kaltakquise', label: 'Kaltakquise' },
        ]
      },
    ]
  },
  {
    category: 'ANALYSE',
    items: [
      { href: '/dashboard/analytics', label: 'Sales-Controlling' },
    ]
  },
  {
    category: 'INHALTE',
    items: [
      { href: '/dashboard/forms', label: 'Formulare' },
    ]
  },
  {
    category: 'SYSTEM',
    items: [
      { href: '/dashboard/settings', label: 'Einstellungen' },
    ]
  },
]

function NavLink({ href, label, subItems }: { href: string; label: string; subItems?: { href: string; label: string }[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isActive = (linkHref: string) => {
    const linkPath = linkHref.split('?')[0]
    const linkQuery = linkHref.split('?')[1] || ''
    const currentQuery = searchParams.toString()

    if (linkQuery) {
      return pathname === linkPath && currentQuery === linkQuery
    }
    return pathname === linkPath
  }

  const isActiveOrSub = isActive(href) || (subItems?.some(sub => isActive(sub.href)) ?? false)

  return (
    <div>
      <Link
        href={href}
        className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActiveOrSub
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {label}
      </Link>
      {subItems && (
        <div className="ml-3 space-y-0.5 border-l border-gray-200 pl-2">
          {subItems.map((sub) => (
            <Link
              key={sub.href}
              href={sub.href}
              className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive(sub.href)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ClientNav() {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
      {navItems.map((category) => (
        <div key={category.category}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {category.category}
          </p>
          <div className="mt-1 space-y-0.5">
            {category.items.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} subItems={item.subItems} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
