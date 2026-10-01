// Rollen in profiles.role: "employee" (Mitglied), "admin" (Admin eines Mandanten),
// "super_admin" (Betreiber: zusätzlich Kundenverwaltung über alle Mandanten).
// Super-Admins haben überall auch alle Admin-Rechte.
export type UserRole = "employee" | "admin" | "super_admin";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "super_admin";
}

export function roleLabel(role: string | null | undefined): string {
  if (role === "super_admin") return "Super-Admin";
  if (role === "admin") return "Administrator";
  return "Mitarbeiter";
}
