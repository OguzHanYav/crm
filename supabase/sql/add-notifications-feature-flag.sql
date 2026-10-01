-- Feature-Freigabe "Benachrichtigungen & Log-Übersicht" für Mitglieder.
-- Standard: gesperrt (Admins sehen die Seite immer). Für bestehende Installationen,
-- in denen create-feature-flags.sql bereits ausgeführt wurde.
INSERT INTO public.feature_flags (key, enabled)
VALUES ('notifications', false)
ON CONFLICT (key) DO NOTHING;
