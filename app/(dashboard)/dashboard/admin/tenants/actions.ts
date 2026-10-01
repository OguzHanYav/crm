"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { currentUserIsSuperAdmin } from "@/lib/features";
import { createClient } from "@/utils/supabase/server";
import { PLAN_KEYS, TENANT_FEATURE_KEYS, overridesFor, resolveFeatures, type PlanKey } from "@/lib/plans";
import type { TenantInput, TenantRow, TenantUser, TenantUserInput } from "./types";

type ActionResult<T = undefined> = { success: boolean; message?: string; data?: T };

const TENANTS_PATH = "/dashboard/admin/tenants";

// Kundenverwaltung arbeitet mandantenübergreifend -> Service-Role (RLS auf
// tenants erlaubt Nutzern nur den eigenen Mandanten). Jede Aktion prüft vorher
// die Super-Admin-Rolle.
async function guard(): Promise<string | null> {
  return (await currentUserIsSuperAdmin()) ? null : "Keine Berechtigung: Nur Super-Admins dürfen Kunden verwalten.";
}

function validate(input: TenantInput): string | null {
  if (!input.name?.trim()) return "Bitte einen Namen eingeben.";
  if (input.name.trim().length > 120) return "Der Name ist zu lang (max. 120 Zeichen).";
  if (!PLAN_KEYS.includes(input.plan)) return "Ungültiges Paket.";
  for (const key of TENANT_FEATURE_KEYS) {
    if (typeof input.features?.[key] !== "boolean") return "Ungültige Feature-Einstellungen.";
  }
  return null;
}

function toRow(row: any, userCount = 0): TenantRow {
  const plan = (PLAN_KEYS.includes(row.plan) ? row.plan : "standard") as PlanKey;
  const overrides = row.features && typeof row.features === "object" ? row.features : {};
  return {
    id: row.id,
    name: row.name,
    plan,
    overrides,
    features: resolveFeatures(plan, overrides),
    userCount,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

export async function listTenants(): Promise<ActionResult<TenantRow[]>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };

  const admin = getServiceRoleClient();
  const [{ data: tenants, error }, { data: profiles, error: profilesError }] = await Promise.all([
    admin.from("tenants").select("id, name, plan, features, is_default, created_at").order("created_at", { ascending: true }),
    admin.from("profiles").select("tenant_id"),
  ]);
  if (error) return { success: false, message: error.message };
  if (profilesError) console.error("listTenants profiles error:", profilesError.message);

  const counts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.tenant_id) counts.set(p.tenant_id, (counts.get(p.tenant_id) ?? 0) + 1);
  }
  return { success: true, data: (tenants ?? []).map((t) => toRow(t, counts.get(t.id) ?? 0)) };
}

// ==================== BENUTZER EINES KUNDEN ====================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateUser(user: TenantUserInput): string | null {
  if (!user.name?.trim()) return "Bitte den Namen des Benutzers eingeben.";
  if (!EMAIL_RE.test(user.email?.trim() ?? "")) return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (!user.sendInvite && (user.password ?? "").length < MIN_PASSWORD_LENGTH) {
    return `Das temporäre Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  }
  if (user.role !== "admin" && user.role !== "employee") return "Ungültige Rolle.";
  return null;
}

// "Hüseyin Tas" -> Vorname "Hüseyin", Nachname "Tas" (letztes Wort = Nachname).
function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

// Ziel des Einladungslinks: Seite zum Festlegen des Passworts. Basis-URL aus
// NEXT_PUBLIC_SITE_URL, sonst aus der aktuellen Anfrage.
async function updatePasswordUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/auth/update-password`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/auth/update-password`;
}

// Legt den Auth-Benutzer an (Passwort oder Einladung) und verknüpft das Profil
// mit dem Mandanten. Schlägt das Profil fehl, wird der Auth-Benutzer wieder
// entfernt, damit keine verwaisten Logins entstehen.
async function provisionUser(tenantId: string, user: TenantUserInput): Promise<ActionResult<TenantUser>> {
  const admin = getServiceRoleClient();
  const email = user.email.trim().toLowerCase();
  const { firstName, lastName } = splitName(user.name);
  const metadata = { first_name: firstName, last_name: lastName };

  const { data: authData, error: authError } = user.sendInvite
    ? await admin.auth.admin.inviteUserByEmail(email, { data: metadata, redirectTo: await updatePasswordUrl() })
    : await admin.auth.admin.createUser({ email, password: user.password, email_confirm: true, user_metadata: metadata });

  if (authError || !authData?.user) {
    const message = authError?.message ?? "Benutzer konnte nicht angelegt werden.";
    console.error("provisionUser auth error:", message);
    return {
      success: false,
      message: /already|registered|exists/i.test(message)
        ? `Für ${email} existiert bereits ein Benutzer.`
        : `Benutzer konnte nicht angelegt werden: ${message}`,
    };
  }

  // upsert: ein DB-Trigger auf auth.users legt evtl. schon ein Profil an.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: user.role,
      tenant_id: tenantId,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("provisionUser profile error:", profileError.message);
    await admin.auth.admin.deleteUser(authData.user.id);
    return { success: false, message: `Profil konnte nicht angelegt werden: ${profileError.message}` };
  }

  return {
    success: true,
    data: { id: authData.user.id, email, firstName, lastName, role: user.role },
  };
}

export async function listTenantUsers(tenantId: string): Promise<ActionResult<TenantUser[]>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };

  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .eq("tenant_id", tenantId)
    .order("first_name", { ascending: true });
  if (error) return { success: false, message: error.message };
  return {
    success: true,
    data: (data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      firstName: p.first_name,
      lastName: p.last_name,
      role: p.role,
    })),
  };
}

export async function addTenantUser(tenantId: string, user: TenantUserInput): Promise<ActionResult<TenantUser>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const invalid = validateUser(user);
  if (invalid) return { success: false, message: invalid };

  const admin = getServiceRoleClient();
  const { data: tenant } = await admin.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (!tenant) return { success: false, message: "Kunde nicht gefunden." };

  const result = await provisionUser(tenantId, user);
  if (result.success) revalidatePath(TENANTS_PATH);
  return result;
}

// Kunde + Erst-Administrator in einem Schritt. Scheitert der Benutzer, wird der
// eben angelegte Kunde wieder entfernt (kein halb angelegter Mandant).
export async function createTenant(
  input: TenantInput,
  firstAdmin: TenantUserInput
): Promise<ActionResult<TenantRow>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const invalid = validate(input) ?? validateUser({ ...firstAdmin, role: "admin" });
  if (invalid) return { success: false, message: invalid };

  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("tenants")
    .insert({ name: input.name.trim(), plan: input.plan, features: overridesFor(input.plan, input.features) })
    .select("id, name, plan, features, is_default, created_at")
    .single();
  if (error) {
    console.error("createTenant error:", error.message);
    return { success: false, message: error.message };
  }

  const userResult = await provisionUser(data.id, { ...firstAdmin, role: "admin" });
  if (!userResult.success) {
    await admin.from("tenants").delete().eq("id", data.id);
    return { success: false, message: userResult.message };
  }

  revalidatePath(TENANTS_PATH);
  return { success: true, data: toRow(data, 1) };
}

export async function updateTenant(tenantId: string, input: TenantInput): Promise<ActionResult<TenantRow>> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const invalid = validate(input);
  if (invalid) return { success: false, message: invalid };

  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("tenants")
    .update({ name: input.name.trim(), plan: input.plan, features: overridesFor(input.plan, input.features) })
    .eq("id", tenantId)
    .select("id, name, plan, features, is_default, created_at")
    .single();
  if (error) {
    console.error("updateTenant error:", error.message);
    return { success: false, message: error.message };
  }
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);

  // Paket/Features wirken sofort auf Navigation & Guards aller Nutzer.
  revalidatePath("/dashboard", "layout");
  return { success: true, data: toRow(data, count ?? 0) };
}

// Löschen nur für leere Kunden: ohne Benutzer und ohne Daten (Fremdschlüssel
// auf tenant_id verhindern das Löschen, solange noch Datensätze existieren).
// Die Bestätigung des Namens prüft der Server erneut (doppelte Sicherheitsabfrage).
export async function deleteTenant(tenantId: string, confirmName: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };

  const admin = getServiceRoleClient();
  const { data: tenant, error: loadError } = await admin
    .from("tenants")
    .select("id, name, is_default")
    .eq("id", tenantId)
    .maybeSingle();
  if (loadError) return { success: false, message: loadError.message };
  if (!tenant) return { success: false, message: "Kunde nicht gefunden." };
  if (tenant.is_default) return { success: false, message: "Der Standard-Mandant kann nicht gelöscht werden." };
  if (confirmName.trim() !== tenant.name) {
    return { success: false, message: "Der eingegebene Name stimmt nicht überein — nichts gelöscht." };
  }

  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if ((count ?? 0) > 0) {
    return {
      success: false,
      message: `Der Kunde hat noch ${count} Benutzer. Bitte zuerst Benutzer entfernen oder einem anderen Kunden zuordnen.`,
    };
  }

  const { error } = await admin.from("tenants").delete().eq("id", tenantId);
  if (error) {
    console.error("deleteTenant error:", error.message);
    const hasData = error.code === "23503" || /foreign key/i.test(error.message);
    return {
      success: false,
      message: hasData
        ? "Der Kunde hat noch Daten (Kontakte, Deals, …). Bitte diese zuerst entfernen."
        : error.message,
    };
  }

  revalidatePath(TENANTS_PATH);
  return { success: true };
}

// ==================== MANDANT ÖFFNEN (IMPERSONATION) ====================
// Der aktive Mandant eines Super-Admins steht in admin_impersonation; die
// DB-Funktion current_tenant_id() wertet ihn aus (003_super_admin_impersonation.sql).
// Dadurch sehen alle Seiten — inkl. RLS — automatisch die Daten des Kunden.

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function switchTenant(tenantId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const userId = await currentUserId();
  if (!userId) return { success: false, message: "Nicht angemeldet." };

  const admin = getServiceRoleClient();
  const [{ data: tenant }, { data: me }] = await Promise.all([
    admin.from("tenants").select("id").eq("id", tenantId).maybeSingle(),
    admin.from("profiles").select("tenant_id").eq("id", userId).maybeSingle(),
  ]);
  if (!tenant) return { success: false, message: "Kunde nicht gefunden." };

  // Eigener Heimat-Mandant = Impersonation beenden.
  const { error } =
    me?.tenant_id === tenantId
      ? await admin.from("admin_impersonation").delete().eq("user_id", userId)
      : await admin
          .from("admin_impersonation")
          .upsert({ user_id: userId, tenant_id: tenantId, started_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    console.error("switchTenant error:", error.message);
    return {
      success: false,
      message: /admin_impersonation/.test(error.message)
        ? "Mandanten-Wechsel ist noch nicht eingerichtet (supabase/migrations/003_super_admin_impersonation.sql)."
        : error.message,
    };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function stopImpersonation(): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const userId = await currentUserId();
  if (!userId) return { success: false, message: "Nicht angemeldet." };

  const admin = getServiceRoleClient();
  const { error } = await admin.from("admin_impersonation").delete().eq("user_id", userId);
  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// ==================== PASSWÖRTER VON KUNDEN-BENUTZERN ====================

async function profileEmail(userId: string): Promise<string | null> {
  const admin = getServiceRoleClient();
  const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

// Schickt dem Benutzer einen Link zum Festlegen eines neuen Passworts.
export async function sendUserPasswordReset(userId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const email = await profileEmail(userId);
  if (!email) return { success: false, message: "Für diesen Benutzer ist keine E-Mail-Adresse hinterlegt." };

  const admin = getServiceRoleClient();
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: await updatePasswordUrl() });
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Reset-Link an ${email} gesendet.` };
}

// Setzt sofort ein neues (temporäres) Passwort.
export async function setUserTemporaryPassword(userId: string, password: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  if ((password ?? "").length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.` };
  }
  const admin = getServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { success: false, message: error.message };
  return { success: true };
}

// ==================== BENUTZER VERSCHIEBEN / ENTFERNEN ====================
// Super-Admins (Inhaber) bleiben immer in ihrem eigenen Mandanten; Kunden öffnen
// sie ausschließlich über "Öffnen" (Impersonation), nie per Zuordnung.

const OWNER_LOCKED_MESSAGE = "Super-Admins bleiben immer im Inhaber-Mandanten und können nicht verschoben werden.";

export async function moveTenantUser(userId: string, targetTenantId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };

  const admin = getServiceRoleClient();
  const [{ data: profile }, { data: target }] = await Promise.all([
    admin.from("profiles").select("id, role, tenant_id").eq("id", userId).maybeSingle(),
    admin.from("tenants").select("id").eq("id", targetTenantId).maybeSingle(),
  ]);
  if (!profile) return { success: false, message: "Benutzer nicht gefunden." };
  if (!target) return { success: false, message: "Ziel-Kunde nicht gefunden." };
  if (profile.role === "super_admin") return { success: false, message: OWNER_LOCKED_MESSAGE };
  if (profile.tenant_id === targetTenantId) return { success: true };

  const { error } = await admin.from("profiles").update({ tenant_id: targetTenantId }).eq("id", userId);
  if (error) return { success: false, message: error.message };

  revalidatePath(TENANTS_PATH);
  return { success: true };
}

// Trennt den Benutzer endgültig: Login und Profil werden gelöscht. Seine
// CRM-Daten (Kontakte usw.) gehören dem Mandanten und bleiben erhalten.
export async function removeTenantUser(userId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return { success: false, message: denied };
  const me = await currentUserId();
  if (me === userId) return { success: false, message: "Du kannst deinen eigenen Account nicht entfernen." };

  const admin = getServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!profile) return { success: false, message: "Benutzer nicht gefunden." };
  if (profile.role === "super_admin") return { success: false, message: OWNER_LOCKED_MESSAGE };

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { success: false, message: authError.message };
  await admin.from("profiles").delete().eq("id", userId);

  revalidatePath(TENANTS_PATH);
  return { success: true };
}
