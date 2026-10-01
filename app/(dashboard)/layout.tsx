import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import MobileSidebar from './MobileSidebar'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import QueryProvider from './QueryProvider'
import { SipPhoneProvider } from '@/components/phone/SipPhoneProvider'
import PhoneWidget from '@/components/phone/PhoneWidget'
import { canUseFeature, getFeatureFlags, getUserFeatureOverrides, hiddenHrefsFor } from '@/lib/features'
import { getCurrentTenant, getImpersonation } from '@/lib/tenant'
import AdminTenantBanner from '@/components/tenant/AdminTenantBanner'
import { TenantProvider } from '@/components/tenant/TenantProvider'
import { roleLabel as roleLabelFor } from '@/lib/roles'

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

  const roleLabel = roleLabelFor(profile?.role)

  // Feature-Freigaben: Admins sehen alles, Mitglieder nur freigeschaltete Features.
  // Mandant (Paket) + Feature-Freigaben: Menüpunkte und Telefonie nur, wenn das
  // Feature im Paket enthalten UND für den Nutzer freigegeben ist.
  const [featureFlags, featureOverrides, tenant, impersonation] = await Promise.all([
    getFeatureFlags(),
    getUserFeatureOverrides(user.id),
    getCurrentTenant(),
    getImpersonation(),
  ])
  const hiddenNavHrefs = hiddenHrefsFor(profile?.role, featureFlags, featureOverrides, tenant)
  const callsEnabled = canUseFeature(profile?.role, featureFlags, 'calls', featureOverrides, tenant)

  // SipPhoneProvider umschließt das gesamte Dashboard, damit Registrierung und
  // laufende Gespräche beim Seitenwechsel innerhalb des Dashboards erhalten bleiben.
  return (
    <TenantProvider tenant={tenant} isImpersonating={impersonation.active}>
    <SipPhoneProvider enabled={callsEnabled}>
      <Sidebar role={roleLabel} hiddenNavHrefs={hiddenNavHrefs}>
        <AdminTenantBanner />
        <Topbar displayName={displayName} role={roleLabel} mobileNav={<MobileSidebar hiddenNavHrefs={hiddenNavHrefs} />} />
        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-clip bg-background p-3 max-sm:min-h-0 max-sm:overflow-y-auto max-sm:overflow-x-hidden max-sm:overscroll-contain max-sm:pb-0 sm:p-6">
          <QueryProvider>{children}</QueryProvider>
        </main>
      </Sidebar>
      <PhoneWidget />
    </SipPhoneProvider>
    </TenantProvider>
  )
}
