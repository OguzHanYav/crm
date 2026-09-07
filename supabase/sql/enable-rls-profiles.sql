-- Behebt Supabase-Sicherheitswarnung: Policies existieren bereits für
-- public.profiles, RLS war auf der Tabelle selbst aber nicht aktiviert.
alter table public.profiles enable row level security;
