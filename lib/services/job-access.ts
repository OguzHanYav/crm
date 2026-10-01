import { createClient } from "@/utils/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";

// Die Versand-Queue arbeitet mit dem Service-Role-Client (umgeht RLS). Bevor eine
// Route einen Job liest oder verarbeitet, prüft sie daher mit der Session des
// Nutzers, ob der Job sichtbar ist — RLS (multi-tenancy.sql) liefert nur Jobs
// des eigenen Mandanten.
export async function canAccessJob(jobId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_jobs").select("id").eq("id", jobId).maybeSingle();
  return Boolean(data);
}

// Mandant eines Jobs (für den mandantenspezifischen E-Mail-Absender). null, wenn
// das Mandanten-Schema noch nicht eingerichtet ist.
export async function getJobTenantId(jobId: string): Promise<string | null> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin.from("notification_jobs").select("tenant_id").eq("id", jobId).maybeSingle();
  if (error) return null;
  return (data as { tenant_id?: string } | null)?.tenant_id ?? null;
}
