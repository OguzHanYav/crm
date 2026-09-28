"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getPipelinePhases } from "@/app/(dashboard)/dashboard/deals/data";
import { getServiceRoleClient, getAdminOrFallbackClient } from "@/lib/supabase/admin";
import { deleteContactsWithDependents } from "@/lib/supabase/admin-delete";
import { isCurrentUserAdmin } from "@/app/(dashboard)/dashboard/settings/admin-actions";
import { sendEmail } from "@/lib/services/email";
import { sendWhatsAppTemplate } from "@/lib/services/whatsapp";
import { getNotificationSettings } from "@/lib/services/notification-settings";
import type { Contact, ContactStatus, Note, CallLog } from "./types";

export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

const CONTACTS_PATH = "/dashboard/kontakte";

// ==================== HELPER ====================
function parseContactForm(formData: FormData) {
  return {
    first_name: (formData.get("first_name") as string)?.trim(),
    last_name: (formData.get("last_name") as string)?.trim(),
    email: (formData.get("email") as string)?.trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    company: (formData.get("company") as string)?.trim() || null,
    status: formData.get("status") as ContactStatus,
    notes: (formData.get("notes") as string)?.trim() || null,
    assigned_to: (formData.get("assigned_to") as string) || null,
  };
}

// Hinweis: `getContacts`/`loadMoreContacts` (Server Action) lebten früher hier
// als veraltetes Duplikat von ./data.ts — entfernt zugunsten von
// app/api/contacts/route.ts (Edge Function), die ContactsTable.tsx jetzt direkt
// per fetch() aufruft. Die serverseitig gerenderte erste Seite nutzt weiterhin
// getContacts aus ./data.ts (unverändert, siehe kontakte/page.tsx).

export async function getContactCompanies(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("company")
    .not("company", "is", null)
    .order("company", { ascending: true });

  if (error || !data) {
    console.error("getContactCompanies error:", error?.message);
    return [];
  }

  return [...new Set(data.map((row: any) => row.company).filter(Boolean))];
}

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("getCurrentUserRole error:", error.message);
    return null;
  }

  return profile?.role ?? null;
}

export async function getTeamMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("getTeamMembers error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getContactById(contactId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
      id, first_name, last_name, email, phone, company, position, address, country,
      status, notes, assigned_to, last_contacted_at, created_at,
      assigned_profile:profiles!contacts_assigned_to_fkey ( id, first_name, last_name )
      `
    )
    .eq("id", contactId)
    .single();

  if (error) {
    console.error("getContactById error:", error.message);
    return null;
  }

  const result = data as any;
  if (result.assigned_profile && Array.isArray(result.assigned_profile)) {
    result.assigned_profile = result.assigned_profile[0] || null;
  }

  return result;
}

export async function getContactNotes(contactId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .select(
      `
      id, contact_id, author_id, content, created_at,
      author:profiles!notes_author_id_fkey ( id, first_name, last_name )
      `
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getContactNotes error:", error.message);
    return [];
  }

  return (data ?? []).map((item: any) => {
    if (item.author && Array.isArray(item.author)) {
      item.author = item.author[0] || null;
    }
    return item;
  });
}

export async function getContactCallLogs(contactId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("call_logs")
    .select(
      `
      id, contact_id, user_id, call_type, interest_expressed, called_at, notes, created_at,
      author:profiles!call_logs_user_id_fkey ( id, first_name, last_name )
      `
    )
    .eq("contact_id", contactId)
    .order("called_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getContactCallLogs error:", error.message);
    return [];
  }

  return (data ?? []).map((item: any) => {
    if (item.author && Array.isArray(item.author)) {
      item.author = item.author[0] || null;
    }
    return item;
  });
}

export async function getContactDeals(contactId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      `
      id, name, value, stage_id, pipeline_id,
      stage:deal_stages!deals_stage_id_fkey ( name, color ),
      pipeline:pipelines ( name )
      `
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getContactDeals error:", error.message);
    return [];
  }

  return (data ?? []).map((item: any) => {
    if (item.stage && Array.isArray(item.stage)) {
      item.stage = item.stage[0] || null;
    }
    if (item.pipeline && Array.isArray(item.pipeline)) {
      item.pipeline = item.pipeline[0] || null;
    }
    return item;
  });
}

export async function getPipelines() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipelines")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error) {
    console.error("getPipelines error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getContactStageHistory(contactId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_stage_history")
    .select(
      `
      id, deal_id, from_stage_id, to_stage_id, changed_at,
      from_stage:deal_stages!deal_stage_history_from_stage_id_fkey ( name ),
      to_stage:deal_stages!deal_stage_history_to_stage_id_fkey ( name ),
      deals!inner ( contact_id )
      `
    )
    .eq("deals.contact_id", contactId)
    .order("changed_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getContactStageHistory error:", error.message);
    return [];
  }

  return (data ?? []).map((item: any) => {
    if (item.from_stage && Array.isArray(item.from_stage)) {
      item.from_stage = item.from_stage[0] || null;
    }
    if (item.to_stage && Array.isArray(item.to_stage)) {
      item.to_stage = item.to_stage[0] || null;
    }
    return item;
  });
}

// Willkommens-Versand nach Kontakt-Erstellung (autoSendWelcome-Checkbox im
// Anlage-Formular) — siehe app/api/notifications/send/route.ts für den
// äquivalenten Bulk-Versand-Pfad. Loggt jedes Ergebnis als Activity, wirft aber
// nie einen Fehler nach außen (siehe Aufrufer in createContact).
async function sendWelcomeMessages(contact: Contact): Promise<void> {
  const admin = getServiceRoleClient();
  const contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Kontakt";

  if (contact.email) {
    const settings = await getNotificationSettings();
    const result = await sendEmail({
      to: contact.email,
      subject: `Willkommen, ${contact.first_name}!`,
      html: `<p>Hallo ${contact.first_name},</p><p>willkommen! Wir freuen uns auf die Zusammenarbeit.</p>`,
      text: `Hallo ${contact.first_name}, willkommen! Wir freuen uns auf die Zusammenarbeit.`,
      fromOverride: settings.from,
      replyTo: settings.replyTo,
    });

    await admin.from("activities").insert({
      contact_id: contact.id,
      type: result.success ? "email_sent" : "email_failed",
      description: result.success
        ? `Willkommens-E-Mail an ${contactName} gesendet.`
        : `Willkommens-E-Mail an ${contactName} fehlgeschlagen: ${result.error}`,
    });
  }

  if (contact.phone) {
    const result = await sendWhatsAppTemplate({
      to: contact.phone,
      templateName: "welcome_message",
      languageCode: "de",
    });

    await admin.from("activities").insert({
      contact_id: contact.id,
      type: result.success ? "whatsapp_sent" : "whatsapp_failed",
      description: result.success
        ? `Willkommens-WhatsApp-Template an ${contactName} gesendet.`
        : `Willkommens-WhatsApp-Template an ${contactName} fehlgeschlagen: ${result.error}`,
    });
  }
}

// ==================== SERVER ACTIONS (CRUD) ====================
export async function createContact(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const fields = parseContactForm(formData);

  if (!fields.first_name || !fields.last_name || !fields.email || !fields.status) {
    return {
      success: false,
      message: "Vorname, Nachname, E-Mail und Status sind erforderlich.",
    };
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert(fields)
    .select("id, first_name, last_name, email, phone, company, status, notes, created_at")
    .single();

  if (error) {
    console.error("createContact error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(CONTACTS_PATH);

  const autoSendWelcome = formData.get("autoSendWelcome") === "on";
  if (autoSendWelcome) {
    // Bewusst awaited (nicht "fire-and-forget" ohne await): Server Actions können
    // nach dem Return terminieren, bevor ein nicht-awaiteter Hintergrund-Task
    // fertig ist. Fehler werden hier abgefangen und geloggt, damit sie NIE das
    // bereits erfolgreiche Contact-Insert als Fehlschlag erscheinen lassen.
    await sendWelcomeMessages(data as Contact).catch((err) => {
      console.error("sendWelcomeMessages error:", err);
    });
  }

  return { success: true, data: data as Contact };
}

export async function updateContact(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const contactId = formData.get("contact_id") as string;
  const fields = parseContactForm(formData);

  if (!contactId) {
    return { success: false, message: "Kontakt-ID fehlt." };
  }
  if (!fields.first_name || !fields.last_name || !fields.email || !fields.status) {
    return {
      success: false,
      message: "Vorname, Nachname, E-Mail und Status sind erforderlich.",
    };
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(fields)
    .eq("id", contactId)
    .select("id, first_name, last_name, email, phone, company, status, notes, created_at")
    .single();

  if (error) {
    console.error("updateContact error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(CONTACTS_PATH);
  revalidatePath("/dashboard/deals");
  return { success: true, data: data as Contact };
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  const { success, message } = await deleteContactsByAdmin([contactId]);
  return { success, message };
}

// Admin-only: löscht Kontakte inkl. zugehöriger Deals, Notizen, Anrufe usw.
// (siehe lib/supabase/admin-delete.ts). Läuft nach dem Admin-Check über den
// Service-Role-Client, damit RLS-Löschrechte nicht pro Tabelle nötig sind.
export async function deleteContactsByAdmin(contactIds: string[]): Promise<ActionResult<{ deleted: number }>> {
  if (!(await isCurrentUserAdmin())) {
    return { success: false, message: "Keine Berechtigung: Nur Admins dürfen Kontakte löschen." };
  }

  const ids = Array.from(new Set(contactIds.filter(Boolean)));
  if (ids.length === 0) {
    return { success: false, message: "Keine Kontakte ausgewählt." };
  }

  try {
    const client = await getAdminOrFallbackClient();
    await deleteContactsWithDependents(client, ids);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("deleteContactsByAdmin error:", message);
    return { success: false, message: `Löschen fehlgeschlagen: ${message}` };
  }

  revalidatePath(CONTACTS_PATH);
  revalidatePath("/dashboard/deals");
  return { success: true, data: { deleted: ids.length } };
}

export async function addNoteToContact(
  contactId: string,
  noteText: string
): Promise<ActionResult<Note>> {
  const supabase = await createClient();

  const trimmed = noteText.trim();
  if (!trimmed) {
    return { success: false, message: "Notiz darf nicht leer sein." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("notes")
    .insert({
      contact_id: contactId,
      author_id: user?.id ?? null,
      content: trimmed,
    })
    .select(
      `id, contact_id, author_id, content, created_at, author:profiles!notes_author_id_fkey ( id, first_name, last_name )`
    )
    .single();

  if (error) {
    console.error("addNoteToContact error:", error.message);
    return { success: false, message: error.message };
  }

  const result = data as any;
  if (result.author && Array.isArray(result.author)) {
    result.author = result.author[0] || null;
  }

  await supabase
    .from("contacts")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", contactId);

  revalidatePath(`/dashboard/kontakte/${contactId}`);
  return { success: true, data: result as Note };
}

export async function logCall(
  contactId: string,
  formData: FormData
): Promise<ActionResult<CallLog>> {
  const supabase = await createClient();

  const summary = (formData.get("summary") as string)?.trim();
  const call_type = (formData.get("call_type") as string) || "opening_call";
  const interest_raw = formData.get("interest_expressed") as string;
  const interest_expressed = interest_raw === "" ? null : interest_raw === "true";
  const called_at_raw = formData.get("called_at") as string;
  const called_at = called_at_raw ? new Date(called_at_raw).toISOString() : new Date().toISOString();

  if (!summary) {
    return { success: false, message: "Bitte eine Zusammenfassung angeben." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ohne user_id schlägt der Insert an einem NOT-NULL-Constraint fehl und das
  // Speichern im Call-Log-Tab bricht mit einer generischen DB-Fehlermeldung ab.
  if (!user) {
    return { success: false, message: "Nicht angemeldet — Anruf konnte nicht gespeichert werden." };
  }

  const { data, error } = await supabase
    .from("call_logs")
    .insert({
      contact_id: contactId,
      user_id: user.id,
      call_type,
      interest_expressed,
      called_at,
      notes: summary,
    })
    .select(
      `id, contact_id, user_id, call_type, interest_expressed, called_at, notes, created_at, author:profiles!call_logs_user_id_fkey ( first_name, last_name )`
    )
    .single();

  if (error) {
    console.error("logCall error:", error.message);
    return { success: false, message: error.message };
  }

  const result = data as any;
  if (result.author && Array.isArray(result.author)) {
    result.author = result.author[0] || null;
  }

  await supabase
    .from("contacts")
    .update({ last_contacted_at: called_at })
    .eq("id", contactId);

  revalidatePath("/dashboard/kontakte");
  revalidatePath(`/dashboard/kontakte/${contactId}`);
  revalidatePath("/dashboard/deals");
  return { success: true, data: result as CallLog };
}

export async function updateContactDetails(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const contactId = formData.get("contact_id") as string;

  if (!contactId) {
    return { success: false, message: "Kontakt-ID fehlt." };
  }

  const fields = {
    first_name: (formData.get("first_name") as string)?.trim(),
    last_name: (formData.get("last_name") as string)?.trim(),
    email: (formData.get("email") as string)?.trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    company: (formData.get("company") as string)?.trim() || null,
    position: (formData.get("position") as string)?.trim() || null,
    address: (formData.get("address") as string)?.trim() || null,
    country: (formData.get("country") as string)?.trim() || null,
    status: formData.get("status") as Contact["status"],
    assigned_to: (formData.get("assigned_to") as string) || null,
  };

  if (!fields.first_name || !fields.last_name || !fields.email || !fields.status) {
    return {
      success: false,
      message: "Vorname, Nachname, E-Mail und Status sind erforderlich.",
    };
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(fields)
    .eq("id", contactId)
    .select(
      "id, first_name, last_name, email, phone, company, position, address, country, status, notes, assigned_to, last_contacted_at, created_at"
    )
    .single();

  if (error) {
    console.error("updateContactDetails error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(`/dashboard/kontakte/${contactId}`);
  revalidatePath("/dashboard/kontakte");
  return { success: true, data: data as unknown as Contact };
}

// ==================== SHEET DATA FETCHER ====================
export async function getContactDetailPayload(contactId: string) {
  console.time(`[perf] getContactDetailPayload ${contactId}`);
  // Alle fünf Abfragen parallel starten statt in einer Kette (contact -> Rest) —
  // die Existenzprüfung des Kontakts blockiert die anderen Queries nicht mehr.
  const [contactResult, notes, callLogs, deals, stageHistory] = await Promise.all([
    getContactById(contactId),
    getContactNotes(contactId),
    getContactCallLogs(contactId),
    getContactDeals(contactId),
    getContactStageHistory(contactId),
  ]);
  console.timeEnd(`[perf] getContactDetailPayload ${contactId}`);

  if (!contactResult) {
    return { success: false, message: "Kontakt nicht gefunden." };
  }

  return {
    success: true,
    data: { contact: contactResult, notes, callLogs, deals, stageHistory },
  };
}

export async function getContactSheetBootstrap() {
  console.time("[perf] getContactSheetBootstrap");
  const [teamMembers, pipelines, stages, phases] = await Promise.all([
    getTeamMembers(),
    getPipelines(),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("deal_stages")
        .select("id, pipeline_id, name, position, color")
        .order("position", { ascending: true });

      if (error) {
        console.error("getAllStages error:", error.message);
        return [];
      }
      return data ?? [];
    })(),
    getPipelinePhases(),
  ]);
  console.timeEnd("[perf] getContactSheetBootstrap");

  return { success: true, data: { teamMembers, pipelines, stages, phases } };
}
