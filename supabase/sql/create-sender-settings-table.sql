-- Mandantenfähiger E-Mail-Absender: dieselbe CRM-Instanz wird für mehrere Kunden
-- betrieben, jeder Kunde braucht aber seinen eigenen sichtbaren Absender/Reply-To
-- (und ggf. seinen eigenen Resend-Account). Statt das per Env-Var (die pro Deploy
-- fix ist) zu lösen, liegt die Absender-Konfiguration hier in der DB und kann pro
-- Kunde per UPDATE geändert werden, ohne Redeploy — siehe getNotificationSettings()
-- in lib/services/notification-settings.ts.
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE DEFAULT 'default',
  from_email text NOT NULL,
  from_name text,
  reply_to_email text NOT NULL,
  resend_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read notification settings" ON public.notification_settings;
CREATE POLICY "Authenticated users can read notification settings"
  ON public.notification_settings FOR SELECT
  TO authenticated
  USING (true);

-- Keine INSERT/UPDATE/DELETE-Policy: Änderungen laufen ausschließlich über den
-- Service-Role-Client (z. B. manuell im SQL-Editor oder künftig ein Admin-Formular).

INSERT INTO notification_settings (key, from_email, from_name, reply_to_email)
VALUES ('default', 'office@crm.oguzhan-yavuz.com', 'CRM', 'office@oguzhan-yavuz.com')
ON CONFLICT (key) DO NOTHING;
