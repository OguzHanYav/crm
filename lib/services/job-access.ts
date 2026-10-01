import { createClient } from "@/utils/supabase/server";

// Die Versand-Queue arbeitet mit dem Service-Role-Client (umgeht RLS). Bevor eine
// Route einen Job liest oder verarbeitet, prüft sie daher mit der Session des
// Nutzers, ob der Job sichtbar ist — RLS (multi-tenancy.sql) liefert nur Jobs
// des eigenen Mandanten.
export async function canAccessJob(jobId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_jobs").select("id").eq("id", jobId).maybeSingle();
  return Boolean(data);
}
