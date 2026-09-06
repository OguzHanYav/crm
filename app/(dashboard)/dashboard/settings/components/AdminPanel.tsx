"use client";

import { useState, useEffect, useTransition } from "react";
import { getUsers, setUserRole, type UserRow } from "../admin-actions";

export default function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const result = await getUsers();
    if (result.success && result.data) {
      setUsers(result.data);
      // Aktuelle User-ID speichern (für später)
      const { data } = await (await import("@/utils/supabase/client")).createClient().auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    } else {
      setError(result.message ?? "Fehler beim Laden der Benutzer.");
    }
    setLoading(false);
  }

  function handleRoleChange(userId: string, newRole: "admin" | "employee") {
    startTransition(async () => {
      const result = await setUserRole(userId, newRole);
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setError(null);
      } else {
        setError(result.message ?? "Fehler beim Ändern der Rolle.");
      }
    });
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
        <p className="text-sm text-muted-foreground">Lade Benutzer...</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
      <h2 className="text-base font-semibold text-foreground">Benutzerverwaltung</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Hier kannst du die Rollen aller Benutzer verwalten.
      </p>

      {error && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">E-Mail</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rolle</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isAdmin = user.role === "admin";

              return (
                <tr key={user.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {user.first_name || user.last_name
                      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isAdmin
                          ? "bg-accent-soft text-accent"
                          : "bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      {isAdmin ? "Administrator" : "Mitarbeiter"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">(Dein Account)</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() =>
                            handleRoleChange(user.id, isAdmin ? "employee" : "admin")
                          }
                          disabled={isPending}
                          className={`ring-focus rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            isAdmin
                              ? "border border-warning/30 text-warning hover:bg-warning/10"
                              : "border border-accent/30 text-accent hover:bg-accent/10"
                          }`}
                        >
                          {isAdmin ? "👤 Mitarbeiter" : "⭐ Admin"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
