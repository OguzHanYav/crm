import { createClient } from "@/utils/supabase/server";
import type { Contact } from "./types";

export async function getContacts(searchQuery?: string): Promise<Contact[]> {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, status, notes, created_at")
    .order("created_at", { ascending: false });

  if (searchQuery && searchQuery.trim().length > 0) {
    const term = searchQuery.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("getContacts error:", error.message);
    return [];
  }

  return (data ?? []) as Contact[];
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
