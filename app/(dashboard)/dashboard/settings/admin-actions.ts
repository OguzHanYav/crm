"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
};

export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
};

export async function getUsers(): Promise<ActionResult<UserRow[]>> {
  const supabase = await createClient();
  
  // Prüfe ob der aktuelle User Admin ist
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, message: "Nur Administratoren haben Zugriff." };
  }

  // Alle User abrufen
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .order("email", { ascending: true });

  if (error) {
    console.error("getUsers error:", error.message);
    return { success: false, message: error.message };
  }

  return { success: true, data: data as UserRow[] };
}

export async function setUserRole(
  userId: string,
  newRole: "admin" | "employee"
): Promise<ActionResult> {
  const supabase = await createClient();
  
  // Prüfe ob der aktuelle User Admin ist
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, message: "Nur Administratoren dürfen Rollen ändern." };
  }

  // Rolle aktualisieren
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) {
    console.error("setUserRole error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function getCurrentUserRole(): Promise<"admin" | "employee" | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  return profile?.role ?? null;
}
