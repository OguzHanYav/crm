"use server";

import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
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

// ==================== ADMIN-CHECK ====================

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  return profile?.role === "admin";
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ==================== BENUTZER VERWALTEN ====================

export async function getUsers(): Promise<ActionResult<UserRow[]>> {
  const supabase = await createServerClient();
  
  if (!await isCurrentUserAdmin()) {
    return { success: false, message: "Nur Administratoren haben Zugriff." };
  }

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

export async function updateUser(
  userId: string,
  firstName: string,
  lastName: string,
  role?: "admin" | "employee"
): Promise<ActionResult> {
  const supabase = await createServerClient();
  const currentUserId = await getCurrentUserId();
  const isAdmin = await isCurrentUserAdmin();
  
  // Prüfe: Darf der User diesen Account bearbeiten?
  // - Admin darf alle bearbeiten
  // - User darf nur sich selbst bearbeiten
  if (!isAdmin && currentUserId !== userId) {
    return { success: false, message: "Du darfst nur deinen eigenen Account bearbeiten." };
  }

  // Nur Admins dürfen die Rolle ändern
  const updateData: { first_name: string; last_name: string; role?: string } = {
    first_name: firstName,
    last_name: lastName,
  };
  
  if (isAdmin && role) {
    updateData.role = role;
  }

  // Admin-Client mit Service Role Key (umgeht RLS für Admins)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", userId);

  if (error) {
    console.error("updateUser error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function setUserRole(
  userId: string,
  newRole: "admin" | "employee"
): Promise<ActionResult> {
  const supabase = await createServerClient();
  
  if (!await isCurrentUserAdmin()) {
    return { success: false, message: "Nur Administratoren dürfen Rollen ändern." };
  }

  const { data: currentUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (currentUser?.id === userId) {
    return { success: false, message: "Du kannst dir selbst nicht die Admin-Rechte entziehen!" };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { error } = await supabaseAdmin
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

export async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: "admin" | "employee"
): Promise<ActionResult> {
  if (!await isCurrentUserAdmin()) {
    return { success: false, message: "Nur Administratoren dürfen Benutzer anlegen." };
  }

  if (!email || !password) {
    return { success: false, message: "E-Mail und Passwort sind erforderlich." };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (authError) {
    console.error("createUser auth error:", authError.message);
    return { success: false, message: `Fehler beim Anlegen: ${authError.message}` };
  }

  if (!authData.user) {
    return { success: false, message: "Benutzer konnte nicht angelegt werden." };
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: authData.user.id,
      email: email,
      first_name: firstName,
      last_name: lastName,
      role: role,
    });

  if (profileError) {
    console.error("createUser profile error:", profileError.message);
    return { success: false, message: `Profil konnte nicht angelegt werden: ${profileError.message}` };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, message: "Benutzer erfolgreich angelegt!" };
}

export async function updateUserByAdmin(
  userId: string,
  updates: { firstName: string; lastName: string; email: string; password?: string }
): Promise<ActionResult> {
  if (!(await isCurrentUserAdmin())) {
    return { success: false, message: "Nur Administratoren dürfen Benutzer bearbeiten." };
  }

  if (!updates.email) {
    return { success: false, message: "E-Mail ist erforderlich." };
  }

  if (updates.password && updates.password.length < 6) {
    return { success: false, message: "Das Passwort muss mindestens 6 Zeichen lang sein." };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const authUpdate: { email: string; password?: string } = { email: updates.email };
  if (updates.password) authUpdate.password = updates.password;

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);

  if (authError) {
    console.error("updateUserByAdmin auth error:", authError.message);
    return { success: false, message: authError.message };
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      email: updates.email,
    })
    .eq("id", userId);

  if (profileError) {
    console.error("updateUserByAdmin profile error:", profileError.message);
    return { success: false, message: profileError.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, message: "Benutzer erfolgreich aktualisiert." };
}

export async function deleteUserByAdmin(userId: string): Promise<ActionResult> {
  if (!(await isCurrentUserAdmin())) {
    return { success: false, message: "Nur Administratoren dürfen Benutzer löschen." };
  }

  const currentUserId = await getCurrentUserId();
  if (currentUserId === userId) {
    return { success: false, message: "Du kannst deinen eigenen Account nicht löschen." };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (authError) {
    console.error("deleteUserByAdmin auth error:", authError.message);
    return { success: false, message: authError.message };
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);

  if (profileError) {
    console.error("deleteUserByAdmin profile error:", profileError.message);
    return { success: false, message: profileError.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, message: "Benutzer erfolgreich gelöscht." };
}

export async function getCurrentUserRole(): Promise<"admin" | "employee" | null> {
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  return profile?.role ?? null;
}
