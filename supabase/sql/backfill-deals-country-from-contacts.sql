-- Fallback, falls das Matching im Sync-Skript einzelne Deals nicht erfasst hat:
-- kopiert country direkt vom verknüpften Kontakt auf den Deal.
update deals
set country = contacts.country
from contacts
where deals.contact_id = contacts.id
  and deals.country is null
  and contacts.country is not null;
