import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ClientNav from './ClientNav'
import MobileSidebar from './MobileSidebar'
import Topbar from './Topbar'

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
    .select('first_name, last_name, email, role')
    .eq('id', user.id)
    .single()

  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email || user.email

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center justify-between border-r border-border bg-card py-4 sm:flex">
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
            Y
          </div>
          <ClientNav />
        </div>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          title={profile?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
        >
          {profile?.role === 'admin' ? 'AD' : 'MA'}
        </div>
      </aside>

      <div className="flex flex-1 flex-col sm:pl-[72px]">
        <Topbar
          displayName={displayName}
          role={profile?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
          mobileNav={<MobileSidebar />}
        />
        <main className="flex-1 bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
