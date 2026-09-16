# Backup & Restore

Tägliche Backups laufen über `.github/workflows/supabase-backup.yml` (GitHub
Actions, 3 Uhr UTC) und landen als GitHub Artifact (30 Tage Retention) sowie
optional als Commit im `backups`-Branch. Dieses Dokument beschreibt, wie ein
Backup im Notfall wiederhergestellt wird.

**Achtung:** Ein Restore überschreibt Daten in der Ziel-Datenbank. Niemals
direkt gegen die Produktions-Datenbank ausführen, ohne vorher ein frisches
Backup des aktuellen Zustands zu ziehen und den Befehl gegen eine
Staging-/Test-Instanz verifiziert zu haben.

## Voraussetzungen

- Supabase CLI installiert: `npm install -g supabase` (oder `brew install supabase/tap/supabase`)
- Die PostgreSQL-Connection-String der Ziel-Datenbank (Supabase Dashboard →
  Project Settings → Database → Connection String → URI)

## 1. Backup-Datei besorgen

**Aus GitHub Actions Artifact:**

1. Repository → Actions → "Supabase Backup" → gewünschten Run öffnen
2. Artifact `supabase-backup-<timestamp>` herunterladen und entpacken
3. Enthält `schema-<timestamp>.sql` (Schema) und `data-<timestamp>.sql` (Daten)

**Aus dem `backups`-Branch:**

```bash
git fetch origin backups
git show origin/backups:.backups/schema-<timestamp>.sql > schema.sql
```

## 2. Restore ausführen

**Schema zuerst, dann Daten** (Daten referenzieren Fremdschlüssel aus dem Schema):

```bash
# Schema wiederherstellen
supabase db execute --db-url "$SUPABASE_DB_URL" -f schema-<timestamp>.sql

# Daten wiederherstellen
supabase db execute --db-url "$SUPABASE_DB_URL" -f data-<timestamp>.sql
```

`SUPABASE_DB_URL` ist dieselbe Connection-String wie im GitHub Secret (Format:
`postgresql://postgres:<password>@<host>:5432/postgres`).

## 3. Verifizieren

```sql
-- Stichprobe: Zeilenzahlen der wichtigsten Tabellen prüfen
SELECT 'contacts' AS table, count(*) FROM contacts
UNION ALL
SELECT 'deals', count(*) FROM deals
UNION ALL
SELECT 'notification_jobs', count(*) FROM notification_jobs;
```

## 4. Nur eine einzelne Tabelle wiederherstellen

Falls nicht die gesamte Datenbank, sondern nur eine Tabelle betroffen ist, das
gewünschte `CREATE TABLE`/`COPY`-Segment aus der Dump-Datei extrahieren und
gezielt ausführen, statt den vollständigen Dump erneut einzuspielen:

```bash
# Beispiel: nur den Block für "contacts" extrahieren
awk '/CREATE TABLE public.contacts/,/^$/' data-<timestamp>.sql > contacts-only.sql
supabase db execute --db-url "$SUPABASE_DB_URL" -f contacts-only.sql
```

## Manuelles Backup (ohne GitHub Actions)

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f data.sql
```
