import { getServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/services/email";
import { sendWhatsAppTemplate } from "@/lib/services/whatsapp";
import type { NotificationSettings } from "@/lib/services/notification-settings";
import { JOB_LOCK_DURATION_MS } from "@/lib/constants/notifications";

// Warum eine Queue statt synchronem Versand: Vercel Serverless Functions brechen
// nach 10s (Hobby) / 60s (Pro) ab — bei 100+ Kontakten (~0.5-2s pro Mail/WhatsApp
// inkl. Retry) würde ein synchroner Request lange vor Fertigstellung sterben,
// ohne dass der Client erfährt, welche Nachrichten tatsächlich rausgingen. Statt
// dessen legt createJob() sofort einen Job + ein Item pro Kontakt/Kanal an;
// app/api/notifications/jobs/[jobId]/process/route.ts arbeitet in kleinen,
// vom Frontend wiederholt getriggerten Batches ab (siehe JOB_BATCH_SIZE).
//
// Warum ein Lock (acquireJobLock/releaseJobLock): Das Frontend triggert /process
// sowohl direkt nach Job-Erstellung als auch per Self-Trigger (falls der letzte
// Call >5s her ist, z. B. nach Tab-Wechsel) — ohne Lock könnten zwei parallele
// Calls dieselben "pending"-Items gleichzeitig laden und doppelt versenden.
//
// Warum sequenziell statt parallel innerhalb eines Batches: Resend/Meta haben
// Rate-Limits; ein Promise.all über 20 gleichzeitige Sends würde diese eher
// reißen als ein Batch von 20 Requests. Ein kleiner, sequenzieller Batch (20)
// bleibt außerdem sicher unter dem Vercel-Timeout (siehe process/route.ts).

export type JobItem = {
  id: string;
  job_id: string;
  contact_id: string;
  channel: "email" | "whatsapp";
  status: string;
  error: string | null;
  attempts: number;
};

export type JobPayload = {
  emailSubject: string | null;
  emailBody: string | null;
  emailIsHtml: boolean;
  whatsappTemplateName: string | null;
  whatsappLanguageCode: string | null;
};

export type JobCounters = {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
};

export type JobStatus = {
  id: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  remaining: number;
  emailSubject: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type FailedJobItem = {
  id: string;
  contactId: string;
  contactName: string;
  channel: "email" | "whatsapp";
  error: string | null;
};

type CreateJobInput = {
  contactIds: string[];
  channel: "email" | "whatsapp" | "both";
  emailPayload?: { subject: string; body: string; isHtml?: boolean };
  whatsappPayload?: { templateName: string; languageCode?: string };
  userId?: string | null;
};

type ContactRow = {
  id: string;
  email: string | null;
  phone: string | null;
  email_opt_in: boolean | null;
  whatsapp_opt_in: boolean | null;
};

function plainTextToHtml(body: string): string {
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br />");
}

function htmlToPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function logActivity(
  admin: ReturnType<typeof getServiceRoleClient>,
  contactId: string,
  type: "email_sent" | "email_failed" | "whatsapp_sent" | "whatsapp_failed",
  description: string
) {
  const { error } = await admin.from("activities").insert({ contact_id: contactId, type, description });
  if (error) {
    console.error("logActivity error:", error.message);
  }
}

export async function createJob(input: CreateJobInput): Promise<{ jobId: string; totalItems: number }> {
  const admin = getServiceRoleClient();
  const wantsEmail = input.channel === "email" || input.channel === "both";
  const wantsWhatsapp = input.channel === "whatsapp" || input.channel === "both";

  const { data: contacts, error: contactsError } = await admin
    .from("contacts")
    .select("id, email, phone, email_opt_in, whatsapp_opt_in")
    .in("id", input.contactIds);

  if (contactsError) {
    throw new Error(contactsError.message);
  }

  const contactById = new Map<string, ContactRow>((contacts ?? []).map((c) => [c.id, c as ContactRow]));

  const { data: jobRow, error: jobError } = await admin
    .from("notification_jobs")
    .insert({
      status: "pending",
      channel: input.channel,
      email_subject: input.emailPayload?.subject ?? null,
      email_body: input.emailPayload?.body ?? null,
      email_is_html: input.emailPayload?.isHtml ?? false,
      whatsapp_template_name: input.whatsappPayload?.templateName ?? null,
      whatsapp_language_code: input.whatsappPayload?.languageCode ?? null,
      created_by: input.userId ?? null,
    })
    .select("id")
    .single();

  if (jobError || !jobRow) {
    throw new Error(jobError?.message ?? "Job konnte nicht erstellt werden.");
  }

  const jobId = jobRow.id as string;

  type ItemInsert = {
    job_id: string;
    contact_id: string;
    channel: "email" | "whatsapp";
    status: "pending" | "failed" | "skipped_no_consent";
    error: string | null;
  };

  const items: ItemInsert[] = [];

  for (const contactId of input.contactIds) {
    const contact = contactById.get(contactId);

    if (!contact) {
      if (wantsEmail) items.push({ job_id: jobId, contact_id: contactId, channel: "email", status: "failed", error: "Kontakt nicht gefunden." });
      if (wantsWhatsapp) items.push({ job_id: jobId, contact_id: contactId, channel: "whatsapp", status: "failed", error: "Kontakt nicht gefunden." });
      continue;
    }

    if (wantsEmail) {
      if (!contact.email_opt_in) {
        items.push({ job_id: jobId, contact_id: contactId, channel: "email", status: "skipped_no_consent", error: null });
      } else if (!contact.email) {
        items.push({ job_id: jobId, contact_id: contactId, channel: "email", status: "failed", error: "Keine E-Mail-Adresse." });
      } else {
        items.push({ job_id: jobId, contact_id: contactId, channel: "email", status: "pending", error: null });
      }
    }

    if (wantsWhatsapp) {
      if (!contact.whatsapp_opt_in) {
        items.push({ job_id: jobId, contact_id: contactId, channel: "whatsapp", status: "skipped_no_consent", error: null });
      } else if (!contact.phone) {
        items.push({ job_id: jobId, contact_id: contactId, channel: "whatsapp", status: "failed", error: "Keine Telefonnummer." });
      } else {
        items.push({ job_id: jobId, contact_id: contactId, channel: "whatsapp", status: "pending", error: null });
      }
    }
  }

  const INSERT_CHUNK_SIZE = 500;
  for (let i = 0; i < items.length; i += INSERT_CHUNK_SIZE) {
    const { error: itemsError } = await admin.from("notification_job_items").insert(items.slice(i, i + INSERT_CHUNK_SIZE));
    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  const skippedCount = items.filter((i) => i.status === "skipped_no_consent").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const totalItems = items.length;

  const { error: updateError } = await admin
    .from("notification_jobs")
    .update({
      total_items: totalItems,
      skipped_items: skippedCount,
      failed_items: failedCount,
      processed_items: skippedCount + failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (updateError) {
    console.error("createJob counter update error:", updateError.message);
  }

  return { jobId, totalItems };
}

// UPDATE ... WHERE (locked_until IS NULL OR locked_until < now()) AND status IN
// ('pending','processing') — trifft die Zeile nur, wenn kein anderer Prozess
// gerade einen gültigen Lock hält. .select("id") danach verrät, ob der Update
// eine Zeile getroffen hat (Supabase gibt sonst ein leeres Array zurück).
export async function acquireJobLock(jobId: string): Promise<boolean> {
  const admin = getServiceRoleClient();
  const nowIso = new Date().toISOString();
  const lockedUntilIso = new Date(Date.now() + JOB_LOCK_DURATION_MS).toISOString();

  const { data, error } = await admin
    .from("notification_jobs")
    .update({ locked_until: lockedUntilIso, status: "processing", updated_at: nowIso })
    .eq("id", jobId)
    .in("status", ["pending", "processing"])
    .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
    .select("id");

  if (error) {
    console.error("acquireJobLock error:", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function releaseJobLock(jobId: string): Promise<void> {
  const admin = getServiceRoleClient();
  const { error } = await admin.from("notification_jobs").update({ locked_until: null }).eq("id", jobId);
  if (error) {
    console.error("releaseJobLock error:", error.message);
  }
}

export async function getNextPendingItems(jobId: string, limit: number): Promise<JobItem[]> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("notification_job_items")
    .select("id, job_id, contact_id, channel, status, error, attempts")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getNextPendingItems error:", error.message);
    return [];
  }

  return (data ?? []) as JobItem[];
}

export async function getJobPayload(jobId: string): Promise<JobPayload | null> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("notification_jobs")
    .select("email_subject, email_body, email_is_html, whatsapp_template_name, whatsapp_language_code")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getJobPayload error:", error.message);
    return null;
  }

  return {
    emailSubject: data.email_subject,
    emailBody: data.email_body,
    emailIsHtml: data.email_is_html,
    whatsappTemplateName: data.whatsapp_template_name,
    whatsappLanguageCode: data.whatsapp_language_code,
  };
}

async function markItemResult(
  admin: ReturnType<typeof getServiceRoleClient>,
  item: JobItem,
  status: "sent" | "failed",
  error: string | null
) {
  const { error: updateError } = await admin
    .from("notification_job_items")
    .update({ status, error, processed_at: new Date().toISOString(), attempts: item.attempts + 1 })
    .eq("id", item.id);

  if (updateError) {
    console.error("markItemResult error:", updateError.message);
  }
}

export async function processItem(item: JobItem, payload: JobPayload, settings: NotificationSettings): Promise<void> {
  const admin = getServiceRoleClient();

  const { data: contact, error: contactError } = await admin
    .from("contacts")
    .select("id, email, phone, first_name, last_name")
    .eq("id", item.contact_id)
    .maybeSingle();

  if (contactError || !contact) {
    await markItemResult(admin, item, "failed", "Kontakt nicht gefunden.");
    return;
  }

  const contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Kontakt";

  if (item.channel === "email") {
    if (!contact.email) {
      await markItemResult(admin, item, "failed", "Keine E-Mail-Adresse.");
      return;
    }

    const isHtml = payload.emailIsHtml;
    const body = payload.emailBody ?? "";
    const subject = payload.emailSubject ?? "";

    const result = await sendEmail({
      to: contact.email,
      subject,
      html: isHtml ? body : plainTextToHtml(body),
      text: isHtml ? htmlToPlainText(body) : body,
      fromOverride: settings.from,
      replyTo: settings.replyTo,
    });

    if (result.success) {
      await markItemResult(admin, item, "sent", null);
      await logActivity(admin, item.contact_id, "email_sent", `E-Mail "${subject}" an ${contactName} gesendet.`);
    } else {
      await markItemResult(admin, item, "failed", result.error ?? "Unbekannter Fehler.");
      await logActivity(admin, item.contact_id, "email_failed", `E-Mail an ${contactName} fehlgeschlagen: ${result.error}`);
    }
    return;
  }

  if (!contact.phone) {
    await markItemResult(admin, item, "failed", "Keine Telefonnummer.");
    return;
  }

  const templateName = payload.whatsappTemplateName ?? "";
  const result = await sendWhatsAppTemplate({
    to: contact.phone,
    templateName,
    languageCode: payload.whatsappLanguageCode ?? "de",
  });

  if (result.success) {
    await markItemResult(admin, item, "sent", null);
    await logActivity(admin, item.contact_id, "whatsapp_sent", `WhatsApp-Template "${templateName}" an ${contactName} gesendet.`);
  } else {
    await markItemResult(admin, item, "failed", result.error ?? "Unbekannter Fehler.");
    await logActivity(admin, item.contact_id, "whatsapp_failed", `WhatsApp an ${contactName} fehlgeschlagen: ${result.error}`);
  }
}

// Aggregiert die Item-Status per COUNT (4 leichte, indexgestützte
// count-Queries statt aller Zeilen in den Node-Prozess zu laden — wichtig bei
// Jobs mit 1000+ Items) und schreibt das Ergebnis in notification_jobs zurück.
// Setzt den Job auf 'completed' (und löst den Lock), sobald keine 'pending'-
// Items mehr übrig sind.
export async function updateJobCounters(jobId: string): Promise<JobCounters> {
  const admin = getServiceRoleClient();

  const countFor = async (status: string): Promise<number> => {
    const { count, error } = await admin
      .from("notification_job_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", status);

    if (error) {
      console.error(`updateJobCounters count(${status}) error:`, error.message);
      return 0;
    }
    return count ?? 0;
  };

  const [sent, failed, skipped, pending] = await Promise.all([
    countFor("sent"),
    countFor("failed"),
    countFor("skipped_no_consent"),
    countFor("pending"),
  ]);

  const total = sent + failed + skipped + pending;
  const processed = sent + failed + skipped;
  const remaining = pending;
  const nextStatus = remaining === 0 ? "completed" : "processing";

  const updatePayload: Record<string, unknown> = {
    total_items: total,
    processed_items: processed,
    sent_items: sent,
    failed_items: failed,
    skipped_items: skipped,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (remaining === 0) {
    updatePayload.locked_until = null;
  }

  const { error: updateError } = await admin.from("notification_jobs").update(updatePayload).eq("id", jobId);
  if (updateError) {
    console.error("updateJobCounters update error:", updateError.message);
  }

  return { total, processed, sent, failed, skipped, remaining };
}

export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const admin = getServiceRoleClient();
  const { error: updateError } = await admin
    .from("notification_jobs")
    .update({ status: "failed", error, locked_until: null, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (updateError) {
    console.error("markJobFailed error:", updateError.message);
  }
}

// Kein Cache: der Job-Status muss live sein (im Gegensatz zu
// notification-settings.ts, das sich selten ändert).
export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("notification_jobs")
    .select("id, status, total_items, sent_items, failed_items, skipped_items, processed_items, email_subject, created_at, updated_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getJobStatus error:", error.message);
    return null;
  }

  return {
    id: data.id,
    status: data.status,
    total: data.total_items,
    sent: data.sent_items,
    failed: data.failed_items,
    skipped: data.skipped_items,
    processed: data.processed_items,
    remaining: Math.max(0, data.total_items - data.processed_items),
    emailSubject: data.email_subject,
    createdAt: data.created_at,
    completedAt: data.status === "completed" ? data.updated_at : null,
  };
}

export async function getJobItems(jobId: string, filter?: { status?: "failed" }): Promise<FailedJobItem[]> {
  const admin = getServiceRoleClient();
  let query = admin
    .from("notification_job_items")
    .select("id, contact_id, channel, error, status, contact:contacts ( first_name, last_name )")
    .eq("job_id", jobId);

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    console.error("getJobItems error:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
    const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Kontakt" : "Kontakt";
    return {
      id: row.id,
      contactId: row.contact_id,
      contactName,
      channel: row.channel,
      error: row.error,
    } as FailedJobItem;
  });
}
