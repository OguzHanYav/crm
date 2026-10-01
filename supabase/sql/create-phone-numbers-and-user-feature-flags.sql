-- Telefonie-Verwaltung (/dashboard/phone) und Feature-Freigaben pro Mitglied
-- (/dashboard/features). Beide Bereiche sind nur für Admins; Schreibzugriffe
-- laufen ausschließlich über Server Actions mit Admin-Prüfung + Service-Role-Client.
-- Voraussetzung: public.is_admin() (supabase/sql/fix-profiles-rls-recursion.sql)
-- und public.feature_flags (supabase/sql/create-feature-flags.sql).

-- ==================== RUFNUMMERN / TELEFONE ====================
CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Für spätere Mandantenfähigkeit; aktuell ohne Organisations-Tabelle (NULL).
  org_id uuid,
  number text NOT NULL,
  label text,
  assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'connecting')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_number_key ON public.phone_numbers (number);
CREATE INDEX IF NOT EXISTS phone_numbers_assigned_user_idx ON public.phone_numbers (assigned_user_id);

ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read phone numbers" ON public.phone_numbers;
CREATE POLICY "Admins can read phone numbers"
  ON public.phone_numbers FOR SELECT
  TO authenticated
  USING (public.is_admin() OR assigned_user_id = auth.uid());

-- ==================== FEATURE-FREIGABEN PRO MITGLIED ====================
-- Explizite Freigabe/Sperre je Nutzer und Feature. Fehlt eine Zeile, gilt der
-- globale Standard aus public.feature_flags. Admins haben immer alle Features.
CREATE TABLE IF NOT EXISTS public.user_feature_flags (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, feature_key)
);

ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own feature flags, admins all" ON public.user_feature_flags;
CREATE POLICY "Users read own feature flags, admins all"
  ON public.user_feature_flags FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Keine INSERT/UPDATE/DELETE-Policies: nur Service-Role-Client nach Admin-Prüfung.
