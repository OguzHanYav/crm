-- Denormalisiertes Länder-Feld direkt auf deals, damit die Pipeline-Ansicht das
-- Land auch anzeigen kann, wenn contact_id fehlt oder falsch verknüpft ist.
alter table deals add column if not exists country text;
