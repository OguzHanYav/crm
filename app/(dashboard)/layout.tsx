import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import MobileSidebar from './MobileSidebar'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import QueryProvider from './QueryProvider'

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

  const roleLabel = profile?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'

  return (
    <Sidebar role={roleLabel}>
      <Topbar displayName={displayName} role={roleLabel} mobileNav={<MobileSidebar />} />
      <main className="flex-1 bg-background p-4 sm:p-6">
        <QueryProvider>{children}</QueryProvider>
      </main>
    </Sidebar>
  )
}
