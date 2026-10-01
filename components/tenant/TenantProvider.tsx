"use client";

import { createContext, useContext, useMemo } from "react";
import type { PlanKey, TenantFeatureKey, TenantInfo } from "@/lib/tenant";

type TenantContextValue = {
  tenant: TenantInfo;
  plan: PlanKey;
  // Ist das Feature im Paket des aktuellen Kunden enthalten?
  hasFeature: (key: TenantFeatureKey) => boolean;
};

const TenantContext = createContext<TenantContextValue | null>(null);

// Wird im Dashboard-Layout mit dem serverseitig geladenen Mandanten befüllt
// (getCurrentTenant in lib/tenant.ts) — Client-Komponenten lesen ihn per useTenant().
export function TenantProvider({ tenant, children }: { tenant: TenantInfo; children: React.ReactNode }) {
  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      plan: tenant.plan,
      hasFeature: (key) => tenant.features[key] === true,
    }),
    [tenant]
  );
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant() muss innerhalb von <TenantProvider> verwendet werden.");
  return ctx;
}
