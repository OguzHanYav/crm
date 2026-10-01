import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

// Features, die Admins für Mitglieder (role = 'employee') freischalten können.
// Admins haben immer Zugriff. Neue Features: hier ergänzen + Zeile in
// supabase/sql/create-feature-flags.sql.
export const MEMBER_FEATURES = {
  calls: {
    label: "CRM-Telefonie / Anrufe",
    description: "Menüpunkt „Anrufe“ und Anrufen direkt aus dem Browser.",
    href: "/dashboard/anrufe",
  },
} as const;

export type FeatureKey = keyof typeof MEMBER_FEATURES;
export type FeatureFlags = Record<FeatureKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = { calls: false };

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

// Wirksamer Zugriff: Admins immer; Mitglieder nach eigener Freigabe
// (user_feature_flags), sonst nach globalem Standard (feature_flags).
export function canUseFeature(
  role: string | null | undefined,
  flags: FeatureFlags,
  key: FeatureKey,
  overrides: UserFeatureOverrides = {}
): boolean {
  if (role === "admin") return true;
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
  return (await getCurrentUserAccess()).role === "admin";
}

// Für Seiten/API-Routen: darf der eingeloggte Nutzer dieses Feature nutzen?
export async function currentUserCanUseFeature(key: FeatureKey): Promise<boolean> {
  const [{ role, overrides }, flags] = await Promise.all([getCurrentUserAccess(), getFeatureFlags()]);
  return canUseFeature(role, flags, key, overrides);
}

// Navigationsziele, die der Nutzer nicht sehen soll (gesperrte Features + Admin-Bereiche).
export function hiddenHrefsFor(
  role: string | null | undefined,
  flags: FeatureFlags,
  overrides: UserFeatureOverrides = {}
): string[] {
  const hidden = (Object.keys(MEMBER_FEATURES) as FeatureKey[])
    .filter((key) => !canUseFeature(role, flags, key, overrides))
    .map((key) => MEMBER_FEATURES[key].href);
  return role === "admin" ? hidden : [...hidden, ...ADMIN_ONLY_HREFS];
}
