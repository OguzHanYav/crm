-- Listet alle Tabellen im public-Schema ohne aktivierte Row Level Security.
-- Erwartung: leere Ausgabe (alle Tabellen haben RLS aktiviert) — jede Zeile in
-- der Ausgabe ist eine Tabelle, die ungeschützt per Anon/Authenticated-Key
-- direkt erreichbar ist und vor Produktivbetrieb per
-- "ALTER TABLE public.<tabelle> ENABLE ROW LEVEL SECURITY;" (+ Policies)
-- abgesichert werden muss.
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE c.relrowsecurity = true
);
