-- E-Mail-Absender pro Mandant (SMTP oder Resend-API-Key), damit Kunden-
-- Benachrichtigungen nie über den Absender des Betreibers laufen.
-- Voraussetzung: supabase/sql/multi-tenancy.sql und supabase/sql/super-admin-role.sql.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin');
$$;

CREATE TABLE IF NOT EXISTS public.tenant_email_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_name text,
  from_email text,
  reply_to_email text,
  -- Variante A: eigenes SMTP-Postfach des Kunden
  smtp_host text,
  smtp_port integer CHECK (smtp_port IS NULL OR (smtp_port > 0 AND smtp_port < 65536)),
  smtp_user text,
  smtp_password text,
  -- Variante B: eigener Resend-API-Key des Kunden
  api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_email_settings ENABLE ROW LEVEL SECURITY;

-- Lesen/Schreiben: Admins des eigenen Mandanten oder Super-Admins.
DROP POLICY IF EXISTS tenant_email_settings_admin_access ON public.tenant_email_settings;
CREATE POLICY tenant_email_settings_admin_access ON public.tenant_email_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_admin() AND tenant_id = public.current_tenant_id()))
  WITH CHECK (public.is_super_admin() OR (public.is_admin() AND tenant_id = public.current_tenant_id()));
