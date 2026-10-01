"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminOrFallbackClient } from "@/lib/supabase/admin";
import { MEMBER_FEATURES, type FeatureKey } from "@/lib/features";
import { isCurrentUserAdmin } from "./admin-actions";

export type ActionResult = { success: boolean; message?: string };

export async function setFeatureFlag(key: FeatureKey, enabled: boolean): Promise<ActionResult> {
  if (!(await isCurrentUserAdmin())) {
    return { success: false, message: "Keine Berechtigung: Nur Admins dürfen Features freischalten." };
  }
  if (!(key in MEMBER_FEATURES)) {
    return { success: false, message: "Unbekanntes Feature." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const client = await getAdminOrFallbackClient();
  const { error } = await client
    .from("feature_flags")
    .upsert({ key, enabled, updated_at: new Date().toISOString(), updated_by: user?.id ?? null }, { onConflict: "key" });

  if (error) {
    console.error("setFeatureFlag error:", error.message);
    return { success: false, message: error.message };
  }

  // Navigation (Layout) und Seiten aller Nutzer neu rendern.
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
