'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-md border border-line px-3 py-1.5 text-sm text-body transition-colors hover:border-danger hover:text-danger"
    >
      Abmelden
    </button>
  )
}
