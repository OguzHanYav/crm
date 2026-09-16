-- Resend sperrt Accounts ab einer Bounce-Rate von >5% — ohne Feedback-Loop
-- würden wiederholte Sends an tote Adressen diese Quote unbemerkt hochtreiben.
-- Der Resend-Webhook (app/api/webhooks/resend/route.ts) schreibt Bounces/
-- Complaints hier hinein und sperrt den Kontakt für weiteren E-Mail-Versand.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_bounce_reason text,
  ADD COLUMN IF NOT EXISTS email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_complained_at timestamptz;

CREATE INDEX IF NOT EXISTS contacts_email_bounced_at_idx ON public.contacts(email_bounced_at);

-- Erweitert den bestehenden Activity-Type-Constraint um die neuen Bounce-/
-- Complaint-Typen (plus whatsapp_bounced als Vorbereitung für später).
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check
  CHECK (type IN ('email_sent', 'email_failed', 'email_bounced', 'email_complained', 'whatsapp_sent', 'whatsapp_failed', 'whatsapp_bounced'));
