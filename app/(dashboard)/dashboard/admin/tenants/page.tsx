import { redirect } from "next/navigation";
import { currentUserIsSuperAdmin } from "@/lib/features";
import { listTenants } from "./actions";
import { getImpersonation } from "@/lib/tenant";
import TenantTable from "./components/TenantTable";

// Kundenverwaltung über alle Mandanten — nur für Super-Admins (Betreiber).
export default async function TenantsAdminPage() {
  if (!(await currentUserIsSuperAdmin())) redirect("/dashboard?denied=admin_only");

  const [result, impersonation] = await Promise.all([listTenants(), getImpersonation()]);

  return (
    <div className="flex min-w-0 flex-col gap-4 max-sm:pb-16 sm:gap-6">
      {result.success ? (
        <TenantTable initialTenants={result.data ?? []} homeTenantId={impersonation.homeTenantId} />
      ) : (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Kunden konnten nicht geladen werden: {result.message}. Ist <code>supabase/sql/multi-tenancy.sql</code> ausgeführt?
        </div>
      )}
    </div>
  );
}
