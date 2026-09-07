-- Denormalisiertes Adress-Feld direkt auf deals (analog zu deals.country), damit
-- die Pipeline-Ansicht die Adresse auch ohne funktionierenden contact_id-Join zeigt.
alter table deals add column if not exists address text;

update deals d
set address = c.address
from contacts c
where d.contact_id = c.id
  and d.address is null
  and c.address is not null;
