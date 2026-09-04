import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ClientNav from './ClientNav'
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
    .select('full_name, email, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col items-center justify-between border-r border-border bg-card py-4">
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

      <div className="flex flex-1 flex-col pl-[72px]">
        <Topbar
          displayName={profile?.full_name || profile?.email || user.email || ''}
          role={profile?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
        />
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
