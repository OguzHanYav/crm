import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentTenant, tenantHasFeature, type TenantInfo } from "@/lib/tenant";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";

// Features, die Admins für Mitglieder (role = 'employee') freischalten können.
// Admins haben immer Zugriff. Neue Features: hier ergänzen + Zeile in
// supabase/sql/create-feature-flags.sql.
export const MEMBER_FEATURES = {
  calls: {
    label: "CRM-Telefonie / Anrufe",
    description: "Menüpunkt „Anrufe“ und Anrufen direkt aus dem Browser.",
    href: "/dashboard/anrufe",
  },
  notifications: {
    label: "Benachrichtigungen & Log-Übersicht",
    description: "Menüpunkt „Benachrichtigungen“ mit Versand-Jobs, Inhalten und Empfänger-Logs.",
    href: "/dashboard/notifications",
  },
} as const;

export type FeatureKey = keyof typeof MEMBER_FEATURES;
export type FeatureFlags = Record<FeatureKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = { calls: false, notifications: false };

// Pro Request einmal geladen (Layout, Seiten und API teilen sich das Ergebnis).
// Fehlt die Tabelle noch (SQL nicht ausgeführt), gelten die Standardwerte (aus).
export const getFeatureFlags = cache(async (): Promise<FeatureFlags> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feature_flags").select("key, enabled");
  if (error) {
    console.error("getFeatureFlags error:", error.message);
    return { ...DEFAULT_FLAGS };
  }
  const flags = { ...DEFAULT_FLAGS };
  for (const row of data ?? []) {
    if (row.key in flags) flags[row.key as FeatureKey] = Boolean(row.enabled);
  }
  return flags;
});

export type UserFeatureOverrides = Partial<Record<FeatureKey, boolean>>;

// Nur für Admins: Bereiche, die Mitglieder nie sehen (Navigation + Seiten-Guard).
export const ADMIN_ONLY_HREFS = ["/dashboard/phone", "/dashboard/features"];
// Nur für Super-Admins (Betreiber): Kundenverwaltung über alle Mandanten.
export const SUPER_ADMIN_ONLY_HREFS = ["/dashboard/admin/tenants"];

export async function currentUserIsSuperAdmin(): Promise<boolean> {
  return isSuperAdminRole((await getCurrentUserAccess()).role);
}

// Wirksamer Zugriff: Zuerst muss das Feature im Paket des Mandanten enthalten
// sein (lib/tenant.ts). Dann: Admins immer; Mitglieder nach eigener Freigabe
// (user_feature_flags), sonst nach Standard des Mandanten (feature_flags).
export function canUseFeature(
  role: string | null | undefined,
  flags: FeatureFlags,
  key: FeatureKey,
  overrides: UserFeatureOverrides = {},
  tenant?: Pick<TenantInfo, "features">
): boolean {
  if (tenant && !tenantHasFeature(tenant, key)) return false;
  if (isAdminRole(role)) return true;
  return overrides[key] ?? flags[key];
}

// Explizite Freigaben/Sperren eines Nutzers. Fehlt die Tabelle noch, gibt es keine.
export const getUserFeatureOverrides = cache(async (userId: string): Promise<UserFeatureOverrides> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_feature_flags")
    .select("feature_key, enabled")
    .eq("user_id", userId);
  if (error) {
    console.error("getUserFeatureOverrides error:", error.message);
    return {};
  }
  const overrides: UserFeatureOverrides = {};
  for (const row of data ?? []) {
    if (row.feature_key in MEMBER_FEATURES) overrides[row.feature_key as FeatureKey] = Boolean(row.enabled);
  }
  return overrides;
});

const getCurrentUserAccess = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: null as string | null, overrides: {} as UserFeatureOverrides };
  const [{ data }, overrides] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getUserFeatureOverrides(user.id),
  ]);
  return { role: (data?.role as string | undefined) ?? null, overrides };
});

export async function currentUserIsAdmin(): Promise<boolean> {
  return isAdminRole((await getCurrentUserAccess()).role);
}

// Für Seiten/API-Routen: darf der eingeloggte Nutzer dieses Feature nutzen?
export async function currentUserCanUseFeature(key: FeatureKey): Promise<boolean> {
  const [{ role, overrides }, flags, tenant] = await Promise.all([
    getCurrentUserAccess(),
    getFeatureFlags(),
    getCurrentTenant(),
  ]);
  return canUseFeature(role, flags, key, overrides, tenant);
}

// Seiten-Guard: Paket ohne Feature -> "Upgrade erforderlich"; Paket ok, aber
// Mitglied ohne Freigabe -> "Keine Berechtigung". Beides mit Hinweis auf /dashboard.
export async function requireFeature(key: FeatureKey): Promise<void> {
  const tenant = await getCurrentTenant();
  if (!tenantHasFeature(tenant, key)) redirect(`/dashboard?upgrade=${key}`);
  if (!(await currentUserCanUseFeature(key))) redirect(`/dashboard?denied=${key}`);
}

// Navigationsziele, die der Nutzer nicht sehen soll (gesperrte Features + Admin-Bereiche).
export function hiddenHrefsFor(
  role: string | null | undefined,
  flags: FeatureFlags,
  overrides: UserFeatureOverrides = {},
  tenant?: Pick<TenantInfo, "features">
): string[] {
  const hidden: string[] = (Object.keys(MEMBER_FEATURES) as FeatureKey[])
    .filter((key) => !canUseFeature(role, flags, key, overrides, tenant))
    .map((key) => MEMBER_FEATURES[key].href);
  if (!isAdminRole(role)) hidden.push(...ADMIN_ONLY_HREFS);
  if (!isSuperAdminRole(role)) hidden.push(...SUPER_ADMIN_ONLY_HREFS);
  return hidden;
}
