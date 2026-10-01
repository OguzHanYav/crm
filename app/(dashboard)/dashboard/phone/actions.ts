"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrFallbackClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "../settings/admin-actions";
import { currentTenantId, scopeToTenant } from "@/lib/tenant";
import type { PhoneNumber, PhoneNumberInput, PhoneStatus } from "./types";

type ActionResult<T = undefined> = { success: boolean; message?: string; data?: T };

const PHONE_PATH = "/dashboard/phone";
const STATUSES: PhoneStatus[] = ["active", "inactive", "connecting"];
// "*": funktioniert vor und nach der Mandanten-Migration (org_id -> tenant_id).
const SELECT = "*";

// "+49 172 / 123-45" -> "+49 172 / 123-45" (nur Format prüfen; gespeichert wird,
// was der Admin eingibt, damit Durchwahl-Schreibweisen erhalten bleiben).
function validate(input: PhoneNumberInput): string | null {
  const number = input.number.trim();
  if (!number) return "Bitte eine Rufnummer eingeben.";
  if (!/^\+?[0-9][0-9 ()/.-]{2,}$/.test(number)) return "Ungültige Rufnummer (erlaubt: Ziffern, +, Leerzeichen, / - ( )).";
  if (!STATUSES.includes(input.status)) return "Ungültiger Status.";
  return null;
}

function toRow(input: PhoneNumberInput) {
  return {
    number: input.number.trim(),
    label: input.label.trim() || null,
    assigned_user_id: input.assignedUserId || null,
    status: input.status,
  };
}

function friendlyError(message: string): string {
  return /phone_numbers_(tenant_)?number_key/.test(message) ? "Diese Rufnummer ist bereits angelegt." : message;
}

async function guard(): Promise<string | null> {
  return (await isCurrentUserAdmin()) ? null : "Keine Berechtigung: Nur Admins dürfen Telefone verwalten.";
}

export async function createPhoneNumber(input: PhoneNumberInput): Promise<ActionResult<PhoneNumber>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const invalid = validate(input);
  if (invalid) return { success: false, message: invalid };

  const client = await getAdminOrFallbackClient();
  const tenantId = await currentTenantId();
  const { data, error } = await client
    .from("phone_numbers")
    .insert({ ...toRow(input), ...(tenantId ? { tenant_id: tenantId } : {}) })
    .select(SELECT)
    .single();
  if (error) {
    console.error("createPhoneNumber error:", error.message);
    return { success: false, message: friendlyError(error.message) };
  }
  revalidatePath(PHONE_PATH);
  return { success: true, data: data as PhoneNumber };
}

export async function updatePhoneNumber(id: string, input: PhoneNumberInput): Promise<ActionResult<PhoneNumber>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const invalid = validate(input);
  if (invalid) return { success: false, message: invalid };

  const client = await getAdminOrFallbackClient();
  const { data, error } = await scopeToTenant(
    client.from("phone_numbers").update({ ...toRow(input), updated_at: new Date().toISOString() }).eq("id", id),
    await currentTenantId()
  )
    .select(SELECT)
    .single();
  if (error) {
    console.error("updatePhoneNumber error:", error.message);
    return { success: false, message: friendlyError(error.message) };
  }
  revalidatePath(PHONE_PATH);
  return { success: true, data: data as PhoneNumber };
}

export async function assignPhoneNumber(id: string, userId: string | null): Promise<ActionResult<PhoneNumber>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };

  const client = await getAdminOrFallbackClient();
  const { data, error } = await scopeToTenant(
    client.from("phone_numbers").update({ assigned_user_id: userId || null, updated_at: new Date().toISOString() }).eq("id", id),
    await currentTenantId()
  )
    .select(SELECT)
    .single();
  if (error) {
    console.error("assignPhoneNumber error:", error.message);
    return { success: false, message: error.message };
  }
  revalidatePath(PHONE_PATH);
  return { success: true, data: data as PhoneNumber };
}

export async function deletePhoneNumber(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };

  const client = await getAdminOrFallbackClient();
  const { error } = await scopeToTenant(client.from("phone_numbers").delete().eq("id", id), await currentTenantId());
  if (error) {
    console.error("deletePhoneNumber error:", error.message);
    return { success: false, message: error.message };
  }
  revalidatePath(PHONE_PATH);
  return { success: true };
}
