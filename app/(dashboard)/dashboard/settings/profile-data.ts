import { createClient } from "@/utils/supabase/server";

export type ProfileInfo = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export async function getCurrentProfile(): Promise<ProfileInfo | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("getCurrentProfile error:", error.message);
    }

    return {
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      email: user.email ?? "",
      role: profile?.role === "admin" ? "Administrator" : "Mitarbeiter",
    };
  } catch (err) {
    console.error("getCurrentProfile exception:", err);
    return null;
  }
}
