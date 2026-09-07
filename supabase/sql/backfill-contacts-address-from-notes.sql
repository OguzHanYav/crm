-- Extrahiert "Adresse: ..." aus notes (Format aus dem Excel-Import, z. B.
-- "Branche: Gastronomie | Adresse: Musterstr. 1 | Telefon 2: +49 ...") und
-- schreibt den Wert in die echte Spalte contacts.address.
update contacts
set address = trim(substring(notes from 'Adresse:\s*([^|]+)'))
where address is null
  and notes ~* 'Adresse:\s*[^|]+';
