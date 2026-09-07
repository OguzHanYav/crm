-- Vereinheitlicht bereits vorhandene Duplikate in deal_stages (entstanden durch
-- mehrfache Pipeline-Anlage bei Imports): Phasen mit demselben Namen in anderen
-- Pipelines übernehmen is_active/color/position der Zeile aus der kanonischen
-- (alphabetisch ersten) Pipeline. Nötig als einmaliger Cleanup, damit bereits
-- bestehende Abweichungen (z. B. in Settings deaktiviert, andernorts noch aktiv)
-- verschwinden. Ab jetzt hält der App-Code (pipeline-actions.ts) alle Duplikate
-- bei jeder Änderung automatisch synchron.

with canonical_pipeline as (
  select id from pipelines order by name asc limit 1
),
canonical_stages as (
  select ds.*
  from deal_stages ds
  join canonical_pipeline cp on ds.pipeline_id = cp.id
)
update deal_stages ds
set is_active = cs.is_active,
    color = cs.color,
    position = cs.position
from canonical_stages cs
where lower(trim(ds.name)) = lower(trim(cs.name))
  and ds.pipeline_id <> cs.pipeline_id
  and (ds.is_active, ds.color, ds.position) is distinct from (cs.is_active, cs.color, cs.position);
