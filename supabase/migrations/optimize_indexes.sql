-- Performance-Indizes für die Kontakt-Detailansicht (Sheet & /kontakte/[id]) und
-- die Kontakte-Tabelle — verhindert Full Table Scans auf den Foreign-Key- und
-- Filter-/Sortier-Spalten, die bei jedem Öffnen eines Kontakts abgefragt werden.

-- Kontakte
create index if not exists idx_contacts_assigned_to on contacts(assigned_to);
create index if not exists idx_contacts_created_at on contacts(created_at desc);

-- Deals (verknüpfte Kontakte, Pipeline-Phase, Sortierung)
create index if not exists idx_deals_contact_id on deals(contact_id);
create index if not exists idx_deals_stage_id on deals(stage_id);
create index if not exists idx_deals_pipeline_id on deals(pipeline_id);
create index if not exists idx_deals_created_at on deals(created_at desc);

-- Notizen (Aktivitäten-/Notizen-Tab)
create index if not exists idx_notes_contact_id on notes(contact_id);
create index if not exists idx_notes_created_at on notes(created_at desc);

-- Anruf-Protokolle ("activities" in diesem Schema: call_logs)
create index if not exists idx_call_logs_contact_id on call_logs(contact_id);
create index if not exists idx_call_logs_called_at on call_logs(called_at desc);

-- Phasen-Historie (Aktivitäten-Tab)
create index if not exists idx_deal_stage_history_deal_id on deal_stage_history(deal_id);
create index if not exists idx_deal_stage_history_changed_at on deal_stage_history(changed_at desc);

-- Pipeline-Phasen (Sortierung/Filter nach Pipeline)
create index if not exists idx_deal_stages_pipeline_id on deal_stages(pipeline_id);
