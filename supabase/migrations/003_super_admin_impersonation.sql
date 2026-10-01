-- Super-Admin "Mandant öffnen": Ein Super-Admin kann vorübergehend die Umgebung
-- eines Kunden betrachten und verwalten. Der aktive Mandant liegt serverseitig in
-- admin_impersonation (nicht im Browser), damit RLS ihn auswerten kann.
-- Für normale Benutzer ändert sich nichts: current_tenant_id() berücksichtigt den
-- Eintrag ausschließlich bei role = 'super_admin'.
-- Voraussetzung: 002_tenant_email_settings.sql (is_super_admin()).

CREATE TABLE IF NOT EXISTS public.admin_impersonation (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_impersonation ENABLE ROW LEVEL SECURITY;
-- Super-Admins dürfen ihren eigenen Eintrag lesen; geschrieben wird nur über
-- Server Actions mit Service-Role (switchTenant / stopImpersonation).
DROP POLICY IF EXISTS admin_impersonation_read_own ON public.admin_impersonation;
CREATE POLICY admin_impersonation_read_own ON public.admin_impersonation
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Aktiver Mandant: bei Super-Admins der geöffnete Kunde, sonst der eigene.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (
      SELECT i.tenant_id
      FROM public.admin_impersonation i
      JOIN public.profiles p ON p.id = i.user_id
      WHERE i.user_id = auth.uid() AND p.role = 'super_admin'
    ),
    (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
$$;

-- Heimat-Mandant des eingeloggten Nutzers (ohne Impersonation). SECURITY DEFINER,
-- damit die Profil-Policy unten nicht rekursiv profiles abfragt.
CREATE OR REPLACE FUNCTION public.home_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Eigener Profil-Datensatz bleibt beim Öffnen eines Kunden bearbeitbar
-- (tenant_id des Super-Admins ist sein Heimat-Mandant, nicht der geöffnete).
DROP POLICY IF EXISTS tenant_isolation ON public.profiles;
CREATE POLICY tenant_isolation ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (id = auth.uid() OR tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    OR (id = auth.uid() AND tenant_id = public.home_tenant_id())
  );
