-- ============================================================================
-- 005: Verifikation der Mandanten-Trennung — NUR LESEND, ändert nichts.
--
-- Liefert EINE Ergebnistabelle (der Supabase SQL-Editor zeigt nur das letzte
-- Ergebnis an): bereich | objekt | wert | status
--   status = 'OK'      erwartet
--   status = 'FEHLER'  muss behoben werden
--   status = 'INFO'    reine Kennzahl
--
-- Geprüft wird:
--   1. keine Datensätze ohne tenant_id (inkl. NOT-NULL-Constraint)
--   2. Anzahl Kontakte / Deals / Pipelines / Benutzer pro Mandant
--   3. RLS aktiv und Mandanten-Policy an current_tenant_id() gebunden
--      (= auth.uid() -> profiles.tenant_id, bei Super-Admins ggf. geöffneter Kunde)
--   4. Insert-Trigger set_tenant_id vorhanden
--
-- "calls" = call_logs, "notifications" = notification_jobs / notification_job_items.
-- ============================================================================

WITH tables AS (
  SELECT unnest(ARRAY[
    'contacts', 'deals', 'pipelines', 'deal_stages', 'deal_stage_history',
    'notes', 'call_logs', 'activities', 'notification_jobs', 'notification_job_items',
    'phone_numbers', 'feature_flags', 'profiles'
  ]) AS tbl
),
existing AS (
  SELECT tbl FROM tables WHERE to_regclass('public.' || tbl) IS NOT NULL
),

-- 1a. Datensätze ohne tenant_id (dynamisch gezählt)
null_tenants AS (
  SELECT
    '1 Ohne tenant_id'::text AS bereich,
    e.tbl AS objekt,
    (xpath('/row/c/text()', query_to_xml(
      format('SELECT count(*) AS c FROM public.%I WHERE tenant_id IS NULL', e.tbl), false, true, ''
    )))[1]::text AS wert
  FROM existing e
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = 'tenant_id'
  )
),

-- 1b. Spalte tenant_id fehlt oder ist nicht NOT NULL
column_checks AS (
  SELECT
    '1 tenant_id-Spalte'::text AS bereich,
    e.tbl AS objekt,
    COALESCE(c.is_nullable, 'fehlt') AS wert
  FROM existing e
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = 'tenant_id'
),

-- 2. Kennzahlen pro Mandant
per_tenant AS (
  SELECT '2 Pro Mandant'::text AS bereich, t.name || ' — Kontakte' AS objekt,
         (SELECT count(*) FROM public.contacts x WHERE x.tenant_id = t.id)::text AS wert, t.created_at
  FROM public.tenants t
  UNION ALL
  SELECT '2 Pro Mandant', t.name || ' — Deals',
         (SELECT count(*) FROM public.deals x WHERE x.tenant_id = t.id)::text, t.created_at
  FROM public.tenants t
  UNION ALL
  SELECT '2 Pro Mandant', t.name || ' — Pipelines',
         (SELECT count(*) FROM public.pipelines x WHERE x.tenant_id = t.id)::text, t.created_at
  FROM public.tenants t
  UNION ALL
  SELECT '2 Pro Mandant', t.name || ' — Benutzer',
         (SELECT count(*) FROM public.profiles x WHERE x.tenant_id = t.id)::text, t.created_at
  FROM public.tenants t
),

-- 3a. RLS aktiviert?
rls AS (
  SELECT '3 RLS aktiv'::text AS bereich, e.tbl AS objekt,
         CASE WHEN c.relrowsecurity THEN 'an' ELSE 'AUS' END AS wert
  FROM existing e
  JOIN pg_class c ON c.oid = ('public.' || e.tbl)::regclass
),

-- 3b. Mandanten-Policy vorhanden und an current_tenant_id() gebunden?
policies AS (
  SELECT '3 Mandanten-Policy'::text AS bereich, e.tbl AS objekt,
         COALESCE((
           SELECT string_agg(p.policyname || ' (' || p.permissive || ')', ', ')
           FROM pg_policies p
           WHERE p.schemaname = 'public' AND p.tablename = e.tbl
             AND (COALESCE(p.qual, '') ILIKE '%current_tenant_id%' OR COALESCE(p.with_check, '') ILIKE '%current_tenant_id%')
         ), 'keine') AS wert
  FROM existing e
),

-- 3c. Bindung current_tenant_id() -> auth.uid() -> profiles.tenant_id
tenant_fn AS (
  SELECT '3 current_tenant_id()'::text AS bereich, 'Funktionsdefinition'::text AS objekt,
         CASE
           WHEN pg_get_functiondef('public.current_tenant_id()'::regprocedure) ILIKE '%auth.uid()%'
            AND pg_get_functiondef('public.current_tenant_id()'::regprocedure) ILIKE '%profiles%'
           THEN 'auth.uid() -> profiles.tenant_id'
           ELSE 'unerwartet'
         END AS wert
),

-- 4. Insert-Trigger
triggers AS (
  SELECT '4 Trigger set_tenant_id'::text AS bereich, e.tbl AS objekt,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_trigger tg
           WHERE tg.tgrelid = ('public.' || e.tbl)::regclass AND tg.tgname = 'set_tenant_id' AND NOT tg.tgisinternal
         ) THEN 'vorhanden' ELSE 'fehlt' END AS wert
  FROM existing e
)

SELECT bereich, objekt, wert, CASE WHEN wert = '0' THEN 'OK' ELSE 'FEHLER' END AS status FROM null_tenants
UNION ALL
SELECT bereich, objekt, wert, CASE WHEN wert = 'NO' THEN 'OK' ELSE 'FEHLER' END FROM column_checks
UNION ALL
SELECT bereich, objekt, wert, 'INFO' FROM (SELECT * FROM per_tenant ORDER BY created_at, objekt) pt
UNION ALL
SELECT bereich, objekt, wert, CASE WHEN wert = 'an' THEN 'OK' ELSE 'FEHLER' END FROM rls
UNION ALL
SELECT bereich, objekt, wert, CASE WHEN wert <> 'keine' THEN 'OK' ELSE 'FEHLER' END FROM policies
UNION ALL
SELECT bereich, objekt, wert, CASE WHEN wert LIKE 'auth.uid()%' THEN 'OK' ELSE 'FEHLER' END FROM tenant_fn
UNION ALL
SELECT bereich, objekt, wert, CASE WHEN wert = 'vorhanden' THEN 'OK' ELSE 'FEHLER' END FROM triggers
ORDER BY 1, 2;
