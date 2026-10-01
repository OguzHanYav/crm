-- ============================================================================
-- 006: Deals immer in Phasen des EIGENEN Mandanten + fehlerhafte Deals reparieren
--
-- In der Datenbank existiert (außerhalb dieses Repos) eine Automatik auf
-- public.contacts, die zu jedem neuen Kontakt einen Deal anlegt. Sie wählt die
-- Pipeline/Phase ohne Mandantenbezug -> Kontakte eines Mandanten bekommen Deals,
-- die auf Phasen eines ANDEREN Mandanten zeigen (unsichtbar, falsche Zählung,
-- z. B. "4 Deals insgesamt", aber nur 2 sichtbar).
--
-- Die Automatik bleibt bestehen (sie versorgt evtl. Leads, die von außen direkt
-- in contacts geschrieben werden, z. B. ein Website-Formular). Stattdessen sorgt
-- ein Schutz-Trigger auf deals dafür, dass Phase und Pipeline IMMER zum Mandanten
-- des Deals gehören — sonst wird "Neuer Kunde" (bzw. die erste Phase) des
-- eigenen Mandanten gesetzt.
--
-- Danach werden bestehende fehlerhafte Deals repariert:
--   a) Deal zeigt auf fremde Phase UND der Kontakt hat schon einen korrekten
--      Deal im eigenen Mandanten -> Dublette, wird gelöscht
--   b) sonst -> in "Neuer Kunde" (bzw. erste Phase) des eigenen Mandanten
-- Idempotent. Vorher Backup ziehen.
-- ============================================================================

-- 1. Schutz-Trigger: Phase/Pipeline eines Deals müssen zum Mandanten des Deals gehören.
--    Name beginnt mit "zz_", damit er NACH set_tenant_id läuft (alphabetische Reihenfolge).
CREATE OR REPLACE FUNCTION public.enforce_deal_stage_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  stage_tenant uuid;
  target record;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO stage_tenant FROM public.deal_stages WHERE id = NEW.stage_id;
  IF stage_tenant IS NOT DISTINCT FROM NEW.tenant_id THEN
    RETURN NEW;
  END IF;

  SELECT s.id, s.pipeline_id INTO target
  FROM public.deal_stages s
  WHERE s.tenant_id = NEW.tenant_id
  ORDER BY (lower(s.name) = 'neuer kunde') DESC, s.position, s.name
  LIMIT 1;

  IF target.id IS NOT NULL THEN
    NEW.stage_id := target.id;
    NEW.pipeline_id := target.pipeline_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_enforce_deal_stage_tenant ON public.deals;
CREATE TRIGGER zz_enforce_deal_stage_tenant
  BEFORE INSERT OR UPDATE OF stage_id, tenant_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deal_stage_tenant();

-- 2a. Dubletten mit fremder Phase löschen
DELETE FROM public.deals d
USING public.deal_stages s
WHERE s.id = d.stage_id
  AND s.tenant_id <> d.tenant_id
  AND EXISTS (
    SELECT 1
    FROM public.deals d2
    JOIN public.deal_stages s2 ON s2.id = d2.stage_id
    WHERE d2.contact_id = d.contact_id
      AND d2.id <> d.id
      AND d2.tenant_id = d.tenant_id
      AND s2.tenant_id = d2.tenant_id
  );

-- 2b. Übrige Deals mit fremder Phase/Pipeline in den eigenen Mandanten holen
UPDATE public.deals d
SET stage_id = target.stage_id,
    pipeline_id = target.pipeline_id
FROM (
  SELECT d0.id AS deal_id, ts.id AS stage_id, ts.pipeline_id
  FROM public.deals d0
  LEFT JOIN public.deal_stages s0 ON s0.id = d0.stage_id
  LEFT JOIN public.pipelines p0 ON p0.id = d0.pipeline_id
  CROSS JOIN LATERAL (
    SELECT s.id, s.pipeline_id
    FROM public.deal_stages s
    WHERE s.tenant_id = d0.tenant_id
    ORDER BY (lower(s.name) = 'neuer kunde') DESC, s.position, s.name
    LIMIT 1
  ) ts
  WHERE s0.tenant_id IS DISTINCT FROM d0.tenant_id
     OR p0.tenant_id IS DISTINCT FROM d0.tenant_id
) target
WHERE d.id = target.deal_id;

-- Kontrolle (sollte 0 liefern):
--   SELECT count(*) FROM public.deals d JOIN public.deal_stages s ON s.id = d.stage_id
--   WHERE s.tenant_id <> d.tenant_id;
