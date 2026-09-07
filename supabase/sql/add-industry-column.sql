-- Neue Spalte "Branche" (industry) auf contacts UND deals, inkl. Backfill aus
-- notes ("Branche: ..." — Format aus dem Excel-Import).
alter table contacts add column if not exists industry text;
alter table deals add column if not exists industry text;

update contacts
set industry = trim(substring(notes from 'Branche:\s*([^|]+)'))
where industry is null
  and notes ~* 'Branche:\s*[^|]+';

update deals d
set industry = c.industry
from contacts c
where d.contact_id = c.id
  and d.industry is null
  and c.industry is not null;
