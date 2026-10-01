import { getServiceRoleClient } from "@/lib/supabase/admin";
import { currentTenantId, scopeToTenant } from "@/lib/tenant";

// Eigene, schreibgeschützte Queries für die Job-Historie-Ansicht — bewusst
// NICHT über lib/services/notification-queue.ts (Queue-Logik bleibt unberührt),
// sondern direkte Service-Role-Reads, da die Historie andere Felder/Formen
// braucht (paginiert, gruppiert, alle Payload-Felder für "erneut senden").

export type JobChannel = "email" | "whatsapp" | "both";
export type JobItemChannel = "email" | "whatsapp";
export type JobItemStatus = "pending" | "sent" | "failed" | "skipped_no_consent";

export type NotificationJobListRow = {
  id: string;
  status: string;
  channel: JobChannel;
  emailSubject: string | null;
  whatsappTemplateName: string | null;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  createdAt: string;
  updatedAt: string;
  failedItemsPreview: NotificationJobItemRow[];
};

export type NotificationJobDetail = {
  id: string;
  status: string;
  channel: JobChannel;
  emailSubject: string | null;
  emailBody: string | null;
  emailIsHtml: boolean;
  whatsappTemplateName: string | null;
  whatsappLanguageCode: string | null;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  createdAt: string;
  updatedAt: string;
};

export type NotificationJobItemRow = {
  id: string;
  contactId: string;
  contactName: string;
  channel: JobItemChannel;
  status: JobItemStatus;
  error: string | null;
  processedAt: string | null;
};

function mapItemRow(row: any): NotificationJobItemRow {
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Kontakt"
    : "Kontakt";
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName,
    channel: row.channel,
    status: row.status,
    error: row.error,
    processedAt: row.processed_at ?? null,
  };
}

const PREVIEW_FAILED_ITEMS_PER_JOB = 5;

export async function getNotificationJobs({
  limit = 20,
  offset = 0,
  status,
}: { limit?: number; offset?: number; status?: string } = {}): Promise<{
  jobs: NotificationJobListRow[];
  total: number;
}> {
  const admin = getServiceRoleClient();
  // Service-Role umgeht RLS -> Mandant hier explizit filtern.
  const tenantId = await currentTenantId();

  let query = scopeToTenant(
    admin
      .from("notification_jobs")
      .select(
        "id, status, channel, email_subject, whatsapp_template_name, total_items, sent_items, failed_items, skipped_items, processed_items, created_at, updated_at",
        { count: "exact" }
      ),
    tenantId
  )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("getNotificationJobs error:", error.message);
    return { jobs: [], total: 0 };
  }

  const jobs = data ?? [];
  const jobIds = jobs.map((j) => j.id);
  const failedByJob = new Map<string, NotificationJobItemRow[]>();

  if (jobIds.length > 0) {
    const { data: failedItems, error: itemsError } = await admin
      .from("notification_job_items")
      .select("id, job_id, contact_id, channel, error, processed_at, contact:contacts ( first_name, last_name )")
      .in("job_id", jobIds)
      .eq("status", "failed")
      .order("created_at", { ascending: true });

    if (itemsError) {
      console.error("getNotificationJobs failedItems error:", itemsError.message);
    } else {
      for (const row of (failedItems ?? []) as any[]) {
        const list = failedByJob.get(row.job_id) ?? [];
        if (list.length < PREVIEW_FAILED_ITEMS_PER_JOB) {
          list.push(mapItemRow(row));
        }
        failedByJob.set(row.job_id, list);
      }
    }
  }

  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      channel: j.channel,
      emailSubject: j.email_subject,
      whatsappTemplateName: j.whatsapp_template_name,
      total: j.total_items,
      sent: j.sent_items,
      failed: j.failed_items,
      skipped: j.skipped_items,
      processed: j.processed_items,
      createdAt: j.created_at,
      updatedAt: j.updated_at,
      failedItemsPreview: failedByJob.get(j.id) ?? [],
    })),
    total: count ?? jobs.length,
  };
}

export async function getNotificationJobDetail(jobId: string): Promise<NotificationJobDetail | null> {
  const admin = getServiceRoleClient();
  const tenantId = await currentTenantId();
  const { data, error } = await scopeToTenant(
    admin
      .from("notification_jobs")
      .select(
        "id, status, channel, email_subject, email_body, email_is_html, whatsapp_template_name, whatsapp_language_code, total_items, sent_items, failed_items, skipped_items, processed_items, created_at, updated_at"
      )
      .eq("id", jobId),
    tenantId
  ).maybeSingle();

  if (error || !data) {
    if (error) console.error("getNotificationJobDetail error:", error.message);
    return null;
  }

  return {
    id: data.id,
    status: data.status,
    channel: data.channel,
    emailSubject: data.email_subject,
    emailBody: data.email_body,
    emailIsHtml: data.email_is_html,
    whatsappTemplateName: data.whatsapp_template_name,
    whatsappLanguageCode: data.whatsapp_language_code,
    total: data.total_items,
    sent: data.sent_items,
    failed: data.failed_items,
    skipped: data.skipped_items,
    processed: data.processed_items,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getNotificationJobItems(
  jobId: string,
  { status, limit = 50, offset = 0 }: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ items: NotificationJobItemRow[]; total: number }> {
  const admin = getServiceRoleClient();
  const tenantId = await currentTenantId();

  let query = scopeToTenant(
    admin
      .from("notification_job_items")
      .select("id, contact_id, channel, status, error, processed_at, contact:contacts ( first_name, last_name )", {
        count: "exact",
      })
      .eq("job_id", jobId),
    tenantId
  )
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("getNotificationJobItems error:", error.message);
    return { items: [], total: 0 };
  }

  const items = (data ?? []).map(mapItemRow);
  return { items, total: count ?? items.length };
}
