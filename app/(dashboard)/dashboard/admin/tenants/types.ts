import type { PlanKey, TenantFeatureKey } from "@/lib/plans";

export type TenantRow = {
  id: string;
  name: string;
  plan: PlanKey;
  // gespeicherte Abweichungen vom Paket (tenants.features)
  overrides: Partial<Record<TenantFeatureKey, boolean>>;
  // wirksame Features (Paket + Abweichungen)
  features: Record<TenantFeatureKey, boolean>;
  userCount: number;
  isDefault: boolean;
  createdAt: string;
};

export type TenantInput = {
  name: string;
  plan: PlanKey;
  features: Record<TenantFeatureKey, boolean>;
};

export type TenantUserInput = {
  name: string;
  email: string;
  // Temporäres Passwort ODER Einladungs-E-Mail (Supabase setzt dann den Link).
  password: string;
  sendInvite: boolean;
  role: "admin" | "employee";
};

export type TenantUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
};
