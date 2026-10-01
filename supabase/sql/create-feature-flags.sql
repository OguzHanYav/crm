-- Feature-Freigaben für Mitglieder (role = 'employee'). Admins sehen immer alle
-- Features; für Mitglieder entscheidet "enabled". Lesen dürfen alle eingeloggten
-- Nutzer (Navigation/Seiten brauchen den Status), schreiben nur Admins über
-- Server Actions mit Service-Role-Client (setFeatureFlag in
-- app/(dashboard)/dashboard/settings/feature-actions.ts).
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- Keine INSERT/UPDATE/DELETE-Policy: Änderungen nur über den Service-Role-Client.

INSERT INTO public.feature_flags (key, enabled)
VALUES ('calls', false), ('notifications', false)
ON CONFLICT (key) DO NOTHING;
