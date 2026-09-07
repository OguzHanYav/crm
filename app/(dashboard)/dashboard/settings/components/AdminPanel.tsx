"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getUsers,
  updateUser,
  createUser,
  updateUserByAdmin,
  deleteUserByAdmin,
  type UserRow,
} from "../admin-actions";

export default function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Neuer User Formular
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "employee">("employee");
  const [showForm, setShowForm] = useState(false);

  // Edit User
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "employee">("employee");
  const [showRoleField, setShowRoleField] = useState(false);

  // Delete User
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    const result = await getUsers();
    if (result.success && result.data) {
      setUsers(result.data);
      const { data } = await (await import("@/utils/supabase/client")).createClient().auth.getUser();
      const userId = data.user?.id ?? null;
      setCurrentUserId(userId);
      
      // Prüfe ob der aktuelle User Admin ist
      const currentUser = result.data.find(u => u.id === userId);
      setIsAdmin(currentUser?.role === "admin");
    } else {
      setError(result.message ?? "Fehler beim Laden der Benutzer.");
    }
    setLoading(false);
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setDeleteConfirmId(null);
    setEditFirstName(user.first_name || "");
    setEditLastName(user.last_name || "");
    setEditEmail(user.email || "");
    setEditPassword("");
    setEditRole(user.role as "admin" | "employee");
    setShowRoleField(isAdmin); // Nur Admins können Rolle ändern
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(userId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      // Admins können Name, E-Mail, Passwort und Rolle jedes Benutzers ändern
      // (Service-Role-Client) — Mitarbeiter dürfen an sich selbst nur den Namen ändern.
      const result = isAdmin
        ? await updateUserByAdmin(userId, {
            firstName: editFirstName,
            lastName: editLastName,
            email: editEmail,
            password: editPassword || undefined,
          })
        : await updateUser(userId, editFirstName, editLastName);

      if (result.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  first_name: editFirstName,
                  last_name: editLastName,
                  email: isAdmin ? editEmail : u.email,
                  role: showRoleField ? editRole : u.role,
                }
              : u
          )
        );
        setEditingId(null);
        setSuccess(result.message ?? "Benutzer erfolgreich aktualisiert.");
      } else {
        setError(result.message ?? "Fehler beim Aktualisieren.");
      }
    });
  }

  function confirmDelete(userId: string) {
    setError(null);
    setSuccess(null);
    setEditingId(null);
    setDeleteConfirmId(userId);
  }

  function cancelDelete() {
    setDeleteConfirmId(null);
  }

  function performDelete(userId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await deleteUserByAdmin(userId);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setDeleteConfirmId(null);
        setSuccess(result.message ?? "Benutzer erfolgreich gelöscht.");
      } else {
        setError(result.message ?? "Fehler beim Löschen.");
        setDeleteConfirmId(null);
      }
    });
  }

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!newEmail || !newPassword || !newFirstName || !newLastName) {
      setError("Alle Felder sind erforderlich.");
      return;
    }

    startTransition(async () => {
      const result = await createUser(newEmail, newPassword, newFirstName, newLastName, newRole);
      if (result.success) {
        setSuccess(result.message ?? "Benutzer erfolgreich angelegt.");
        setNewEmail("");
        setNewPassword("");
        setNewFirstName("");
        setNewLastName("");
        setNewRole("employee");
        setShowForm(false);
        loadUsers();
      } else {
        setError(result.message ?? "Fehler beim Anlegen des Benutzers.");
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Benutzerverwaltung</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin 
              ? "Hier kannst du alle Benutzer verwalten, bearbeiten und ihre Rollen anpassen."
              : "Hier kannst du deine eigenen Profildaten bearbeiten."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="ring-focus rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:brightness-110"
          >
            {showForm ? "✕ Abbrechen" : "+ Neuer Benutzer"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      {success && (
        <p className="mt-3 rounded-md bg-success/10 px-3 py-2 text-sm text-success">{success}</p>
      )}

      {/* Neuer Benutzer Formular (nur Admin) */}
      {showForm && isAdmin && (
        <form onSubmit={handleCreateUser} className="mt-4 rounded-lg border border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Vorname</label>
              <input
                type="text"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="ring-focus w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
                placeholder="Max"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nachname</label>
              <input
                type="text"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="ring-focus w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
                placeholder="Mustermann"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">E-Mail</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="ring-focus w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
                placeholder="user@beispiel.de"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Passwort</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="ring-focus w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Rolle</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "employee")}
                className="ring-focus w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                <option value="employee">Mitarbeiter</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isPending}
                className="ring-focus w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
              >
                {isPending ? "Wird angelegt..." : "Benutzer anlegen"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Benutzer Tabelle */}
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
              const isAdminUser = user.role === "admin";
              const isEditing = editingId === user.id;

              return (
                <tr key={user.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          className="ring-focus w-20 rounded border border-border bg-input px-2 py-1 text-sm"
                          placeholder="Vorname"
                        />
                        <input
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          className="ring-focus w-20 rounded border border-border bg-input px-2 py-1 text-sm"
                          placeholder="Nachname"
                        />
                      </div>
                    ) : (
                      user.first_name || user.last_name
                        ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                        : "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {isEditing && isAdmin ? (
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="ring-focus w-full min-w-[160px] rounded border border-border bg-input px-2 py-1 text-sm"
                          placeholder="E-Mail"
                          required
                        />
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="ring-focus w-full min-w-[160px] rounded border border-border bg-input px-2 py-1 text-sm"
                          placeholder="Neues Passwort (optional)"
                          minLength={6}
                        />
                      </div>
                    ) : (
                      user.email
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing && showRoleField ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as "admin" | "employee")}
                        className="ring-focus rounded border border-border bg-input px-2 py-1 text-sm"
                      >
                        <option value="employee">Mitarbeiter</option>
                        <option value="admin">Administrator</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isAdminUser
                            ? "bg-accent-soft text-accent"
                            : "bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {isAdminUser ? "Administrator" : "Mitarbeiter"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirmId === user.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-danger">Wirklich löschen?</span>
                        <button
                          onClick={() => performDelete(user.id)}
                          disabled={isPending}
                          className="ring-focus rounded-md bg-danger px-3 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
                        >
                          Ja, löschen
                        </button>
                        <button
                          onClick={cancelDelete}
                          className="ring-focus rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(user.id)}
                          disabled={isPending}
                          className="ring-focus rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
                        >
                          Speichern
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="ring-focus rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (isSelf || isAdmin) ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(user)}
                          className="ring-focus rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                        >
                          ✎ Bearbeiten
                        </button>
                        {isAdmin && !isSelf && (
                          <button
                            onClick={() => confirmDelete(user.id)}
                            className="ring-focus rounded-md border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/10"
                          >
                            🗑 Löschen
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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
