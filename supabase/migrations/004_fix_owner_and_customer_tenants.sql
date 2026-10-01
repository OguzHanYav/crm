-- ============================================================================
-- 004: Inhaber-Mandant und Kunden-Mandant "Hüseyin Tas" sauber trennen.
--
-- Ausgangslage: Der Standard-Mandant (is_default) wurde zu "Hüseyin Tas"
-- umbenannt. Darin liegen der Super-Admin (Inhaber), Hüseyins Benutzer und alle
-- CRM-Daten.
--
-- Ergebnis:
--   * Standard-Mandant  -> "LeadFlow / Oguz Han Yavuz" (Paket super, bleibt is_default)
--   * neuer Mandant     -> "Hüseyin Tas" (Paket standard)
--   * Benutzer außer Super-Admins -> nach "Hüseyin Tas"   (Schalter move_users)
--   * Kontakte, Deals, Pipelines usw. -> nach "Hüseyin Tas" (Schalter move_data)
--
-- WICHTIG — danach sieht der Inhaber in seinem eigenen Mandanten ein LEERES CRM.
-- Hüseyins Daten öffnet er über Kundenverwaltung → "Öffnen" (gelbe Leiste oben).
-- Vorher ein Backup ziehen. Idempotent: ein zweiter Lauf ändert nichts mehr.
-- ============================================================================

DO $$
DECLARE
  -- ===== Schalter =====
  owner_email   text    := 'office@oguzhan-yavuz.com';
  owner_name    text    := 'LeadFlow / Oguz Han Yavuz';
  customer_name text    := 'Hüseyin Tas';
  customer_plan text    := 'standard';
  move_users    boolean := true;   -- alle Nicht-Super-Admins des Inhaber-Mandanten verschieben
  move_data     boolean := true;   -- alle CRM-Daten des Inhaber-Mandanten verschieben
  -- ====================

  owner_tenant    uuid;
  customer_tenant uuid;
  t               text;
  moved           integer;
BEGIN
  SELECT tenant_id INTO owner_tenant FROM public.profiles WHERE email = owner_email;
  IF owner_tenant IS NULL THEN
    RAISE EXCEPTION 'Profil % nicht gefunden oder ohne tenant_id', owner_email;
  END IF;

  -- Super-Admin ist ggf. gerade in einem Kunden "eingeloggt" -> beenden.
  IF to_regclass('public.admin_impersonation') IS NOT NULL THEN
    DELETE FROM public.admin_impersonation
    WHERE user_id IN (SELECT id FROM public.profiles WHERE email = owner_email);
  END IF;

  -- 1. Inhaber-Mandant umbenennen (bleibt Standard-Mandant mit vollem Paket).
  UPDATE public.tenants SET name = owner_name, plan = 'super' WHERE id = owner_tenant;
  RAISE NOTICE 'Inhaber-Mandant % heißt jetzt "%"', owner_tenant, owner_name;

  -- 2. Kunden-Mandant anlegen bzw. wiederverwenden.
  SELECT id INTO customer_tenant FROM public.tenants
  WHERE name = customer_name AND id <> owner_tenant
  ORDER BY created_at LIMIT 1;

  IF customer_tenant IS NULL THEN
    INSERT INTO public.tenants (name, plan) VALUES (customer_name, customer_plan)
    RETURNING id INTO customer_tenant;
    RAISE NOTICE 'Mandant "%" angelegt: %', customer_name, customer_tenant;
  ELSE
    RAISE NOTICE 'Mandant "%" existiert bereits: %', customer_name, customer_tenant;
  END IF;

  -- 3a. Benutzer verschieben — Super-Admins bleiben IMMER im Inhaber-Mandanten.
  IF move_users THEN
    UPDATE public.profiles SET tenant_id = customer_tenant
    WHERE tenant_id = owner_tenant AND role <> 'super_admin';
    GET DIAGNOSTICS moved = ROW_COUNT;
    RAISE NOTICE '% Benutzer nach "%" verschoben', moved, customer_name;
  END IF;

  -- 3b. CRM-Daten verschieben (nur Tabellen, die es gibt).
  IF move_data THEN
    FOREACH t IN ARRAY ARRAY[
      'contacts', 'deals', 'pipelines', 'deal_stages', 'deal_stage_history',
      'notes', 'call_logs', 'activities', 'notification_jobs', 'notification_job_items',
      'phone_numbers', 'feature_flags'
    ]
    LOOP
      IF to_regclass('public.' || t) IS NULL THEN
        CONTINUE;
      END IF;
      -- feature_flags hat PK (tenant_id, key): nur Schlüssel übernehmen, die der
      -- Kunde noch nicht hat.
      IF t = 'feature_flags' THEN
        UPDATE public.feature_flags f SET tenant_id = customer_tenant
        WHERE f.tenant_id = owner_tenant
          AND NOT EXISTS (SELECT 1 FROM public.feature_flags c WHERE c.tenant_id = customer_tenant AND c.key = f.key);
      ELSE
        EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id = $2', t)
          USING customer_tenant, owner_tenant;
      END IF;
      GET DIAGNOSTICS moved = ROW_COUNT;
      RAISE NOTICE '%: % Zeilen nach "%" verschoben', t, moved, customer_name;
    END LOOP;
  END IF;
END $$;

-- Kontrolle:
--   SELECT t.name, t.plan, t.is_default,
--          (SELECT count(*) FROM public.profiles p WHERE p.tenant_id = t.id) AS benutzer,
--          (SELECT count(*) FROM public.contacts c WHERE c.tenant_id = t.id) AS kontakte
--   FROM public.tenants t ORDER BY t.created_at;
