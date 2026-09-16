-- Aktivitäts-Log für E-Mail-/WhatsApp-Versand (siehe app/api/notifications/send/route.ts
-- und die Willkommens-Nachricht in kontakte/actions.ts createContact).
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email_sent', 'email_failed', 'whatsapp_sent', 'whatsapp_failed')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_contact_id_idx ON public.activities(contact_id);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON public.activities(created_at DESC);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read activities" ON public.activities;
CREATE POLICY "Authenticated users can read activities"
  ON public.activities FOR SELECT
  TO authenticated
  USING (true);

-- Inserts laufen ausschließlich über den Service-Role-Client in der Notifications-
-- API-Route/Server Action (umgeht RLS) — keine INSERT-Policy für normale Sessions nötig.
