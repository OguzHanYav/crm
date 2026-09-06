-- Stellt sicher, dass jede Pipeline eine "Follow-up"-Phase an Position 0 hat,
-- und setzt sie als Standard-Phase für bestehende Deals ohne Phase sowie für
-- Kontakte, die noch keinen verknüpften Deal haben.

-- 1) "Follow-up"-Stage pro Pipeline anlegen, falls sie fehlt
insert into deal_stages (pipeline_id, name, position, color)
select p.id, 'Follow-up', 0, '#0284C7'
from pipelines p
where not exists (
  select 1 from deal_stages ds
  where ds.pipeline_id = p.id and ds.name ilike 'Follow-up'
);

-- 2) Bestehende Deals ohne Phase auf "Follow-up" ihrer Pipeline setzen
update deals d
set stage_id = fu.id
from deal_stages fu
where fu.pipeline_id = d.pipeline_id
  and fu.name ilike 'Follow-up'
  and d.stage_id is null;

-- 3) Für Kontakte ohne verknüpften Deal automatisch einen Deal in "Follow-up" anlegen
insert into deals (name, pipeline_id, stage_id, contact_id, value)
select
  trim(concat(c.first_name, ' ', c.last_name)),
  fu.pipeline_id,
  fu.id,
  c.id,
  0
from contacts c
cross join lateral (
  select ds.id, ds.pipeline_id
  from deal_stages ds
  where ds.name ilike 'Follow-up'
  order by ds.pipeline_id
  limit 1
) fu
where not exists (
  select 1 from deals d where d.contact_id = c.id
);
