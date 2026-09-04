import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-foreground">Einstellungen</h1>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Profil</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="text-foreground">{profile?.full_name ?? "—"}</dd>
          <dt className="text-muted-foreground">E-Mail</dt>
          <dd className="text-foreground">{profile?.email ?? user.email}</dd>
          <dt className="text-muted-foreground">Rolle</dt>
          <dd className="text-foreground">{profile?.role === "admin" ? "Administrator" : "Mitarbeiter"}</dd>
        </dl>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Pipeline-Einstellungen</h2>
        <p className="text-sm text-muted-foreground">
          Verwaltung von Pipelines &amp; Deal-Phasen folgt hier.
        </p>
      </div>
    </div>
  );
}
