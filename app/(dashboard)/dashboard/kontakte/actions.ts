"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Contact, ContactStatus } from "./types";

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

  // Rollen-Check: nur admin darf löschen
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
