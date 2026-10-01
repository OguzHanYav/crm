"use server";

import { revalidatePath } from "next/cache";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { currentUserIsSuperAdmin, currentUserIsAdmin } from "@/lib/features";
import { currentTenantId } from "@/lib/tenant";
import { sendEmail } from "@/lib/services/email";
import { getNotificationSettings, invalidateNotificationSettings } from "@/lib/services/notification-settings";

type ActionResult<T = undefined> = { success: boolean; message?: string; data?: T };

export type EmailSettingsView = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  mode: "smtp" | "resend";
  smtpHost: string;
  smtpPort: number | null;
  smtpUser: string;
  // Geheimnisse werden nie an den Browser geschickt — nur, ob eines hinterlegt ist.
  hasSmtpPassword: boolean;
  hasApiKey: boolean;
};

export type EmailSettingsInput = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  mode: "smtp" | "resend";
  smtpHost: string;
  smtpPort: number | null;
  smtpUser: string;
  // leer = unverändert lassen
  smtpPassword: string;
  apiKey: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Super-Admins: jeder Mandant. Admins: nur der eigene (aktive) Mandant.
async function canManage(tenantId: string): Promise<boolean> {
  if (await currentUserIsSuperAdmin()) return true;
  return (await currentUserIsAdmin()) && (await currentTenantId()) === tenantId;
}

export async function getTenantEmailSettings(tenantId: string): Promise<ActionResult<EmailSettingsView>> {
  if (!(await canManage(tenantId))) return { success: false, message: "Keine Berechtigung." };

  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("tenant_email_settings")
    .select("from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_user, smtp_password, api_key")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { success: false, message: error.message };

  return {
    success: true,
    data: {
      fromName: data?.from_name ?? "",
      fromEmail: data?.from_email ?? "",
      replyTo: data?.reply_to_email ?? "",
      mode: data?.smtp_host ? "smtp" : "resend",
      smtpHost: data?.smtp_host ?? "",
      smtpPort: data?.smtp_port ?? null,
      smtpUser: data?.smtp_user ?? "",
      hasSmtpPassword: Boolean(data?.smtp_password),
      hasApiKey: Boolean(data?.api_key),
    },
  };
}

export async function saveTenantEmailSettings(tenantId: string, input: EmailSettingsInput): Promise<ActionResult> {
  if (!(await canManage(tenantId))) return { success: false, message: "Keine Berechtigung." };

  if (!EMAIL_RE.test(input.fromEmail.trim())) return { success: false, message: "Bitte eine gültige Absender-E-Mail eingeben." };
  if (input.replyTo.trim() && !EMAIL_RE.test(input.replyTo.trim())) {
    return { success: false, message: "Bitte eine gültige Antwort-Adresse eingeben." };
  }
  if (input.mode === "smtp") {
    if (!input.smtpHost.trim()) return { success: false, message: "Bitte den SMTP-Server eingeben." };
    if (!input.smtpPort || input.smtpPort < 1 || input.smtpPort > 65535) return { success: false, message: "Ungültiger SMTP-Port." };
  }

  const admin = getServiceRoleClient();
  const { data: existing } = await admin
    .from("tenant_email_settings")
    .select("smtp_password, api_key")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const row = {
    tenant_id: tenantId,
    from_name: input.fromName.trim() || null,
    from_email: input.fromEmail.trim(),
    reply_to_email: input.replyTo.trim() || null,
    smtp_host: input.mode === "smtp" ? input.smtpHost.trim() : null,
    smtp_port: input.mode === "smtp" ? input.smtpPort : null,
    smtp_user: input.mode === "smtp" ? input.smtpUser.trim() || null : null,
    smtp_password: input.mode === "smtp" ? input.smtpPassword || existing?.smtp_password || null : null,
    api_key: input.mode === "resend" ? input.apiKey.trim() || existing?.api_key || null : null,
    updated_at: new Date().toISOString(),
  };

  if (input.mode === "resend" && !row.api_key) {
    return { success: false, message: "Bitte den Resend-API-Key des Kunden eingeben." };
  }

  const { error } = await admin.from("tenant_email_settings").upsert(row, { onConflict: "tenant_id" });
  if (error) {
    console.error("saveTenantEmailSettings error:", error.message);
    return { success: false, message: error.message };
  }

  invalidateNotificationSettings(tenantId);
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function sendTenantTestEmail(tenantId: string, to: string): Promise<ActionResult> {
  if (!(await canManage(tenantId))) return { success: false, message: "Keine Berechtigung." };
  if (!EMAIL_RE.test(to.trim())) return { success: false, message: "Bitte eine gültige Empfänger-Adresse eingeben." };

  invalidateNotificationSettings(tenantId);
  const settings = await getNotificationSettings(tenantId);
  if (!settings.configured) return { success: false, message: settings.reason ?? "Kein Absender eingerichtet." };

  const result = await sendEmail({
    to: to.trim(),
    subject: "Test-E-Mail aus LeadFlow",
    text: "Diese Test-E-Mail bestätigt, dass der E-Mail-Absender korrekt eingerichtet ist.",
    html: "<p>Diese Test-E-Mail bestätigt, dass der E-Mail-Absender korrekt eingerichtet ist.</p>",
    fromOverride: settings.from,
    replyTo: settings.replyTo,
    transport: settings.transport,
  });
  return result.success ? { success: true } : { success: false, message: result.error ?? "Versand fehlgeschlagen." };
}
