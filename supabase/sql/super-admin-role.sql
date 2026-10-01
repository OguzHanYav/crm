-- Rolle "super_admin" (Betreiber): darf zusätzlich alle Kunden/Mandanten unter
-- /dashboard/admin/tenants verwalten und hat überall Admin-Rechte.
-- Voraussetzung: supabase/sql/multi-tenancy.sql.
--
-- WICHTIG: profiles.role ist der Enum-Typ public.user_role. Ein neu angelegter
-- Enum-Wert darf erst NACH dem Commit verwendet werden — der Supabase SQL-Editor
-- führt ein Skript als eine Transaktion aus. Daher in ZWEI getrennten Durchläufen
-- ausführen: erst SCHRITT 1 allein, danach SCHRITT 2.

-- ============================== SCHRITT 1 ==============================
-- (allein markieren und ausführen)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';


-- ============================== SCHRITT 2 ==============================
-- (danach separat markieren und ausführen)

-- is_admin() (genutzt von bestehenden RLS-Policies) erkennt Super-Admins als Admins.
-- Die Policies selbst bleiben unverändert.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- Eigenen Account zum Super-Admin machen (E-Mail ggf. anpassen):
UPDATE public.profiles SET role = 'super_admin' WHERE email = 'office@oguzhan-yavuz.com';
