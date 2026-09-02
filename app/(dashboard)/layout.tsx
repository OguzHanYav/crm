import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import SignOutButton from './sign-out-button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/deals', label: 'Deals' },
  { href: '/dashboard/kontakte', label: 'Kontakte' },
  { href: '/dashboard/anrufe', label: 'Anrufe' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col justify-between bg-ink text-white">
        <div>
          <div className="px-6 py-5 text-sm font-semibold tracking-tight">
            Yavuz CRM
          </div>
          <nav className="mt-4 space-y-0.5 px-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded-md px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10 px-6 py-4 text-xs text-white/40">
          {profile?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
          <div className="text-sm text-muted">Übersicht</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-ink">
              {profile?.full_name || profile?.email || user.email}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 bg-bg p-6">{children}</main>
      </div>
    </div>
  )
}
