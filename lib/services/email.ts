import { Resend } from "resend";
import nodemailer from "nodemailer";
import { getNotificationsEnv } from "@/lib/config/env";
import { withRetry, RetryableStatusError } from "./retry";

export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  // Absender-Override (aus notification_settings) — sonst Fallback auf
  // env.RESEND_FROM_EMAIL. "from" ist der SICHTBARE Absender im Posteingang,
  // "replyTo" (unten) ist die Adresse, an die eine Antwort tatsächlich geht —
  // beide können unterschiedlich sein (z. B. from: office@crm.kunde.com,
  // replyTo: office@kunde.de).
  fromOverride?: { email: string; name?: string };
  replyTo?: string;
  // Versandweg des Mandanten (tenant_email_settings): eigenes SMTP-Postfach oder
  // eigener Resend-Key. Ohne Angabe: Resend mit RESEND_API_KEY aus der Umgebung.
  transport?: EmailTransport;
};

export type EmailTransport = {
  smtp?: { host: string; port: number; user: string | null; password: string | null } | null;
  resendApiKey?: string | null;
};

export type SendEmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

let resendClient: Resend | null = null;
const tenantResendClients = new Map<string, Resend>();

function getResendClient(apiKey?: string | null): Resend {
  if (apiKey) {
    let client = tenantResendClients.get(apiKey);
    if (!client) {
      client = new Resend(apiKey);
      tenantResendClients.set(apiKey, client);
    }
    return client;
  }
  if (resendClient) return resendClient;
  resendClient = new Resend(getNotificationsEnv().RESEND_API_KEY);
  return resendClient;
}

async function sendViaSmtp(
  smtp: NonNullable<EmailTransport["smtp"]>,
  message: { from: string; to: string; subject: string; html?: string; text?: string; replyTo?: string }
): Promise<SendEmailResult> {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // 465 = implizites TLS, sonst STARTTLS (587/25)
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password ?? "" } : undefined,
  });
  const info = await transporter.sendMail(message);
  return { success: true, messageId: info.messageId };
}

// Resend erwartet entweder "email@domain.com" oder "Name <email@domain.com>".
function formatFrom(email: string, name?: string): string {
  return name ? `${name} <${email}>` : email;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  fromOverride,
  replyTo,
  transport,
}: SendEmailInput): Promise<SendEmailResult> {
  if (!html && !text) {
    return { success: false, error: "E-Mail benötigt entweder html oder text als Inhalt." };
  }

  const env = getNotificationsEnv();

  const fromEmail = fromOverride?.email ?? env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    return { success: false, error: "Kein Absender konfiguriert." };
  }
  const from = formatFrom(fromEmail, fromOverride?.name);

  const resolvedReplyTo = replyTo ?? env.RESEND_REPLY_TO;

  if (transport?.smtp?.host) {
    try {
      return await sendViaSmtp(transport.smtp, {
        from,
        to,
        subject,
        html,
        text,
        ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP-Versand fehlgeschlagen.";
      console.error("sendEmail smtp error:", message);
      return { success: false, error: `SMTP: ${message}` };
    }
  }

  try {
    const resend = getResendClient(transport?.resendApiKey);

    const result = await withRetry(async () => {
      // Cast nötig: resend@4.x typisiert CreateEmailOptions als Union, bei der
      // TypeScript hier fälschlich die react-Pflichtvariante wählt, sobald
      // reply_to als optionales Feld im Objekt steht (SDK-Typ-Bug, nicht unser
      // Code). Die Laufzeit-API akzeptiert das Objekt unverändert.
      const sendPayload = {
        from,
        to,
        subject,
        html,
        text,
        ...(resolvedReplyTo ? { reply_to: resolvedReplyTo } : {}),
      } as Parameters<Resend["emails"]["send"]>[0];

      const { data, error } = await resend.emails.send(sendPayload);

      if (error) {
        const status = (error as { statusCode?: number }).statusCode ?? 500;
        throw new RetryableStatusError(status, error.message);
      }

      return data;
    });

    return { success: true, messageId: result?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler beim E-Mail-Versand.";
    console.error("sendEmail error:", message);
    return { success: false, error: message };
  }
}
