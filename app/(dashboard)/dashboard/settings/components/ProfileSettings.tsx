import type { ProfileInfo } from "../profile-data";

export default function ProfileSettings({ profile }: { profile: ProfileInfo | null }) {
  if (!profile) {
    return (
      <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
        <p className="text-sm text-muted-foreground">Profil konnte nicht geladen werden.</p>
      </section>
    );
  }

  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "—";

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
      <h2 className="text-base font-semibold text-foreground">Profil & Account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Deine Basisdaten, wie sie im System hinterlegt sind.
      </p>

      <div className="mt-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
          {initials}
        </div>
        <div>
          <p className="text-base font-medium text-foreground">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-sm text-muted-foreground">{profile.role}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-xs text-muted-foreground">E-Mail</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">{profile.email}</dd>
        </div>
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-xs text-muted-foreground">Rolle</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">{profile.role}</dd>
        </div>
      </dl>
    </section>
  );
}
