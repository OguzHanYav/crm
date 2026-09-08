import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Deine anderen Einstellungen bleiben hier

  // @supabase/supabase-js wird ausschließlich server-seitig (Server Components/
  // Actions) importiert. Als "external" markiert bündelt Next dessen kompletten
  // Dependency-Graph nicht mehr in jede Serverless-Function hinein — kleinere
  // Function-Bundles, geringfügig kürzere Cold-Start-Ladezeit. Effekt ist real,
  // aber klein (typischerweise zweistellige ms) — kein Ersatz für Region-Alignment.
  serverExternalPackages: ['@supabase/supabase-js'],

  poweredByHeader: false,
}

export default nextConfig
