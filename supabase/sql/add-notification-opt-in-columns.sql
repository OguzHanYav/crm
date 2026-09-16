-- Opt-In-Flags für Bulk-Versand (E-Mail/WhatsApp) — siehe
-- app/api/notifications/send/route.ts. Default false: kein Versand ohne
-- ausdrückliche Zustimmung.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;
