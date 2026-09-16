-- cleanup_old_notification_jobs() gab bisher void zurück — der tägliche Cron
-- (app/api/cron/cleanup-jobs/route.ts) will die Anzahl gelöschter Jobs im
-- Response melden, daher hier per GET DIAGNOSTICS auf ROW_COUNT umgestellt.
CREATE OR REPLACE FUNCTION cleanup_old_notification_jobs()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.notification_jobs
  WHERE created_at < now() - interval '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
