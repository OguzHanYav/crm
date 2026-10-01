"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminOrFallbackClient } from "@/lib/supabase/admin";
import { MEMBER_FEATURES, type FeatureKey } from "@/lib/features";
import { currentUserIsSuperAdmin } from "@/lib/features";

type ActionResult = { success: boolean; message?: string };

async function guard(key: FeatureKey, userId: string): Promise<string | null> {
  if (!(await currentUserIsSuperAdmin())) return "Feature-Freigaben werden zentral durch den Plattform-Inhaber verwaltet.";
  if (!(key in MEMBER_FEATURES)) return "Unbekanntes Feature.";
  // Session-Abfrage (RLS): sichtbar sind nur Profile des eigenen Mandanten.
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!data) return "Dieser Benutzer gehört nicht zu deiner Organisation.";
  return null;
}

// Feature für EIN Mitglied explizit freischalten (true) oder sperren (false).
export async function setUserFeatureFlag(userId: string, key: FeatureKey, enabled: boolean): Promise<ActionResult> {
  const denied = await guard(key, userId);
  if (denied) return { success: false, message: denied };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const client = await getAdminOrFallbackClient();
  const { error } = await client.from("user_feature_flags").upsert(
    {
      user_id: userId,
      feature_key: key,
      enabled,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "user_id,feature_key" }
  );
  if (error) {
    console.error("setUserFeatureFlag error:", error.message);
    return { success: false, message: error.message };
  }
  // Navigation & Seiten-Guards aller Nutzer neu auswerten.
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// Individuelle Einstellung entfernen -> Mitglied folgt wieder dem globalen Standard.
export async function resetUserFeatureFlag(userId: string, key: FeatureKey): Promise<ActionResult> {
  const denied = await guard(key, userId);
  if (denied) return { success: false, message: denied };

  const client = await getAdminOrFallbackClient();
  const { error } = await client.from("user_feature_flags").delete().eq("user_id", userId).eq("feature_key", key);
  if (error) {
    console.error("resetUserFeatureFlag error:", error.message);
    return { success: false, message: error.message };
  }
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
