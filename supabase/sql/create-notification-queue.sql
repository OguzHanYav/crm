-- Queue für Bulk-Versand (E-Mail/WhatsApp): Vercel Serverless Functions brechen
-- nach 10s (Hobby) / 60s (Pro) ab — ein synchroner Versand an 100+ Kontakte im
-- selben Request würde daher abbrechen, ohne dass der User weiß, welche
-- Nachrichten rausgegangen sind. Statt dessen wird ein Job + je ein Item pro
-- Kontakt/Kanal in der DB angelegt und von app/api/notifications/jobs/[jobId]/
-- process/route.ts in kleinen, vom Frontend erneut getriggerten Batches
-- abgearbeitet (siehe lib/services/notification-queue.ts für den Ablauf).
CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  email_subject text,
  email_body text,
  email_is_html boolean NOT NULL DEFAULT false,
  whatsapp_template_name text,
  whatsapp_language_code text,
  total_items integer NOT NULL DEFAULT 0,
  processed_items integer NOT NULL DEFAULT 0,
  sent_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  skipped_items integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid REFERENCES auth.users(id),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.notification_jobs(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped_no_consent')),
  error text,
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_job_items_job_status_idx ON public.notification_job_items(job_id, status);
CREATE INDEX IF NOT EXISTS notification_jobs_status_created_idx ON public.notification_jobs(status, created_at DESC);

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read notification jobs" ON public.notification_jobs;
CREATE POLICY "Authenticated users can read notification jobs"
  ON public.notification_jobs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read notification job items" ON public.notification_job_items;
CREATE POLICY "Authenticated users can read notification job items"
  ON public.notification_job_items FOR SELECT
  TO authenticated
  USING (true);

-- Keine INSERT/UPDATE/DELETE-Policy auf beiden Tabellen: Schreibzugriff läuft
-- ausschließlich über den Service-Role-Client (createJob/processItem/
-- updateJobCounters in lib/services/notification-queue.ts).

-- Noch NICHT als Cron eingerichtet — nur die Funktion anlegen, damit sie später
-- per Supabase-Cron (pg_cron) oder manuell aufgerufen werden kann.
CREATE OR REPLACE FUNCTION cleanup_old_notification_jobs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.notification_jobs
  WHERE created_at < now() - interval '30 days';
END;
$$;
