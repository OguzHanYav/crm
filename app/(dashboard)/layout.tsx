import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getProjects, getActiveProject } from '@/utils/projects/active-project'
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

  const [profileResult, projects, activeProject] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, email, role').eq('id', user.id).single(),
    getProjects(),
    getActiveProject(),
  ])
  const profile = profileResult.data

  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email || user.email

  return (
    <div className="flex min-h-screen bg-[#f3f4f6]">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col items-center justify-between border-r border-gray-200 bg-white py-4">
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            Y
          </div>
          <ClientNav />
        </div>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500"
          title={profile?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
        >
          {profile?.role === 'admin' ? 'AD' : 'MA'}
        </div>
      </aside>

      <div className="flex flex-1 flex-col pl-[72px]">
        <Topbar
          displayName={displayName}
          role={profile?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
          projects={projects}
          activeProjectId={activeProject?.id ?? ''}
        />
        <main className="flex-1 bg-[#f3f4f6] p-6">{children}</main>
      </div>
    </div>
  )
}
