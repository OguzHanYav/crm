-- ============================================================================
-- Multi-Tenancy: Mandanten (tenants) mit Paket (standard/plus/super) und
-- Feature-Overrides, tenant_id auf allen Datentabellen, RLS-Isolation.
--
-- Idempotent (mehrfach ausführbar). Bestehende Daten und Benutzer werden dem
-- Standard-Mandanten (is_default = true, Paket "super") zugeordnet — für die
-- bisherige Firma ändert sich dadurch nichts.
--
-- Voraussetzungen (falls verwendet): create-feature-flags.sql,
-- create-phone-numbers-and-user-feature-flags.sql. Fehlende Tabellen werden
-- übersprungen.
-- ============================================================================

-- ==================== 1. MANDANTEN ====================
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'standard' CHECK (plan IN ('standard', 'plus', 'super')),
  -- Abweichungen vom Paket, z. B. {"whatsapp": true} (siehe lib/tenant.ts)
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_single_default ON public.tenants (is_default) WHERE is_default;

INSERT INTO public.tenants (name, plan, is_default)
SELECT 'Standard-Mandant', 'super', true
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE is_default);

-- ==================== 2. HILFSFUNKTIONEN ====================
-- SECURITY DEFINER: lesen profiles/tenants ohne RLS (vermeidet Rekursion in
-- Policies, analog zu public.is_admin()).
CREATE OR REPLACE FUNCTION public.default_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE is_default LIMIT 1;
$$;

-- profiles bekommt tenant_id, bevor current_tenant_id() darauf zugreift.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.profiles SET tenant_id = public.default_tenant_id() WHERE tenant_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON public.profiles (tenant_id);

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Setzt tenant_id beim INSERT automatisch, damit der bestehende App-Code
-- unverändert bleibt. Reihenfolge:
--   1. explizit übergeben
--   2. Mandant des eingeloggten Nutzers
--   3. Mandant des Eltern-Datensatzes (TG_ARGV: Tabelle, Fremdschlüsselspalte)
--      — z. B. für Service-Role-Inserts aus der Versand-Queue
--   4. Standard-Mandant
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_id text;
  parent_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.tenant_id := public.current_tenant_id();

  IF NEW.tenant_id IS NULL AND TG_NARGS >= 2 THEN
    parent_id := to_jsonb(NEW) ->> TG_ARGV[1];
    IF parent_id IS NOT NULL THEN
      EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', TG_ARGV[0])
        INTO parent_tenant USING parent_id::uuid;
      NEW.tenant_id := parent_tenant;
    END IF;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.default_tenant_id();
  END IF;

  RETURN NEW;
END;
$$;

-- ==================== 3. PROFILES ====================
DROP TRIGGER IF EXISTS set_tenant_id ON public.profiles;
CREATE TRIGGER set_tenant_id BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Restriktiv = zusätzlich zu den bestehenden Profil-Policies. WITH CHECK
-- verhindert, dass ein Nutzer seine eigene tenant_id umstellt.
DROP POLICY IF EXISTS tenant_isolation ON public.profiles;
CREATE POLICY tenant_isolation ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (id = auth.uid() OR tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ==================== 4. DATENTABELLEN ====================
-- phone_numbers hatte eine ungenutzte org_id-Spalte -> durch tenant_id ersetzt.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phone_numbers' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.phone_numbers DROP COLUMN org_id;
  END IF;
END $$;

DO $$
DECLARE
  t record;
  has_rls boolean;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('contacts',               NULL,                NULL),
      ('deals',                  'contacts',          'contact_id'),
      ('pipelines',              NULL,                NULL),
      ('deal_stages',            'pipelines',         'pipeline_id'),
      ('deal_stage_history',     'deals',             'deal_id'),
      ('pipeline_stages',        NULL,                NULL),
      ('notes',                  'contacts',          'contact_id'),
      ('call_logs',              'contacts',          'contact_id'),
      ('activities',             'contacts',          'contact_id'),
      ('notification_jobs',      'profiles',          'created_by'),
      ('notification_job_items', 'notification_jobs', 'job_id'),
      ('phone_numbers',          NULL,                NULL),
      ('feature_flags',          NULL,                NULL)
    ) AS v(tbl, parent, fk)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NULL THEN
      RAISE NOTICE 'Tabelle % existiert nicht — übersprungen', t.tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)', t.tbl);
    EXECUTE format('UPDATE public.%I SET tenant_id = public.default_tenant_id() WHERE tenant_id IS NULL', t.tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t.tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', t.tbl || '_tenant_id_idx', t.tbl);

    EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_id ON public.%I', t.tbl);
    IF t.parent IS NULL THEN
      EXECUTE format('CREATE TRIGGER set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()', t.tbl);
    ELSE
      EXECUTE format('CREATE TRIGGER set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id(%L, %L)', t.tbl, t.parent, t.fk);
    END IF;

    -- Hat die Tabelle schon RLS (mit eigenen Policies), kommt die Isolation als
    -- RESTRICTIVE-Policy dazu (UND-verknüpft, bestehende Rechte bleiben). Ohne
    -- RLS wäre eine reine Restrictive-Policy "alles verboten" — dort daher eine
    -- permissive Mandanten-Policy.
    SELECT relrowsecurity INTO has_rls FROM pg_class WHERE oid = ('public.' || t.tbl)::regclass;
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t.tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_members_access ON public.%I', t.tbl);
    IF has_rls THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
        t.tbl);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tbl);
      EXECUTE format(
        'CREATE POLICY tenant_members_access ON public.%I FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
        t.tbl);
    END IF;
  END LOOP;
END $$;

-- Eindeutigkeit jetzt pro Mandant statt global.
DO $$
BEGIN
  IF to_regclass('public.feature_flags') IS NOT NULL THEN
    ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_pkey;
    ALTER TABLE public.feature_flags ADD PRIMARY KEY (tenant_id, key);
  END IF;
  IF to_regclass('public.phone_numbers') IS NOT NULL THEN
    DROP INDEX IF EXISTS public.phone_numbers_number_key;
    CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_tenant_number_key ON public.phone_numbers (tenant_id, number);
  END IF;
END $$;

-- ==================== 5. MANDANTEN-TABELLE ABSICHERN ====================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own tenant" ON public.tenants;
CREATE POLICY "Users read own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());
-- Keine Schreib-Policies: Pakete/Features ändert nur der Betreiber (SQL / Service-Role).

-- ==================== BEISPIELE (manuell) ====================
-- Neuen Kunden anlegen:
--   INSERT INTO public.tenants (name, plan) VALUES ('Muster GmbH', 'plus') RETURNING id;
-- Benutzer einem Kunden zuordnen:
--   UPDATE public.profiles SET tenant_id = '<tenant-id>' WHERE email = 'chef@muster.de';
-- Einzelnes Feature zusätzlich freischalten:
--   UPDATE public.tenants SET features = features || '{"whatsapp": true}' WHERE id = '<tenant-id>';
