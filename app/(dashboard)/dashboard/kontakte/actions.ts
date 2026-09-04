"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Contact, ContactStatus, Note, CallLog } from "./types";

export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

const CONTACTS_PATH = "/dashboard/kontakte";

function parseContactForm(formData: FormData) {
  const first_name = (formData.get("first_name") as string)?.trim();
  const last_name = (formData.get("last_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const company = (formData.get("company") as string)?.trim() || null;
  const status = formData.get("status") as ContactStatus;
  const notes = (formData.get("notes") as string)?.trim() || null;

  return { first_name, last_name, email, phone, company, status, notes };
}

export async function createContact(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();
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
  return { success: true, data: data as Contact };
}

export async function updateContact(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();
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
  return { success: true, data: data as Contact };
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Nicht angemeldet." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      success: false,
      message: "Keine Berechtigung: Nur Admins dürfen Kontakte löschen.",
    };
  }

  const { error } = await supabase.from("contacts").delete().eq("id", contactId);

  if (error) {
    console.error("deleteContact error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(CONTACTS_PATH);
  return { success: true };
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

  await supabase
    .from("contacts")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", contactId);

  revalidatePath(`/dashboard/kontakte/${contactId}`);
  return { success: true, data: data as unknown as Note };
}

export async function logCall(
  contactId: string,
  formData: FormData
): Promise<ActionResult<CallLog>> {
  const supabase = await createClient();

  const call_type = formData.get("call_type") as string;
  const call_result = formData.get("call_result") as string;
  const call_date = formData.get("call_date") as string;
  const call_time = formData.get("call_time") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!call_type || !call_result || !call_date || !call_time) {
    return { success: false, message: "Bitte alle Pflichtfelder ausfüllen." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("call_logs")
    .insert({
      contact_id: contactId,
      user_id: user?.id ?? null,
      call_type,
      call_result,
      call_date,
      call_time,
      notes,
    })
    .select(
      `id, contact_id, user_id, call_type, call_result, call_date, call_time, notes, created_at, author:profiles!call_logs_user_id_fkey ( id, first_name, last_name )`
    )
    .single();

  if (error) {
    console.error("logCall error:", error.message);
    return { success: false, message: error.message };
  }

  await supabase
    .from("contacts")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", contactId);

  revalidatePath(`/dashboard/kontakte/${contactId}`);
  return { success: true, data: data as unknown as CallLog };
}

export async function updateContactDetails(
  _prevState: ActionResult<Contact>,
  formData: FormData
): Promise<ActionResult<Contact>> {
  const supabase = await createClient();
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
    .select("*")
    .single();

  if (error) {
    console.error("updateContactDetails error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath(`/dashboard/kontakte/${contactId}`);
  revalidatePath("/dashboard/kontakte");
  return { success: true, data: data as unknown as Contact };
}
