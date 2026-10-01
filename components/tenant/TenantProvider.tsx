"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { PlanKey, TenantFeatureKey, TenantInfo } from "@/lib/tenant";
import { stopImpersonation, switchTenant as switchTenantAction } from "@/app/(dashboard)/dashboard/admin/tenants/actions";

type TenantContextValue = {
  tenant: TenantInfo;
  plan: PlanKey;
  // Ist das Feature im Paket des aktuellen Kunden enthalten?
  hasFeature: (key: TenantFeatureKey) => boolean;
  // Super-Admin betrachtet gerade einen fremden Mandanten
  isImpersonating: boolean;
  // Nur für Super-Admins: Mandant öffnen bzw. zur eigenen Umgebung zurückkehren.
  switchTenant: (tenantId: string) => Promise<string | null>;
  exitTenant: () => Promise<string | null>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

// Wird im Dashboard-Layout mit dem serverseitig geladenen Mandanten befüllt
// (getCurrentTenant in lib/tenant.ts) — Client-Komponenten lesen ihn per useTenant().
// Der aktive Mandant selbst liegt serverseitig (admin_impersonation), damit RLS
// ihn auswertet; switchTenant/exitTenant ändern ihn und laden die Seite neu.
export function TenantProvider({
  tenant,
  isImpersonating = false,
  children,
}: {
  tenant: TenantInfo;
  isImpersonating?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const switchTenant = useCallback(
    async (tenantId: string) => {
      const result = await switchTenantAction(tenantId);
      if (!result.success) return result.message ?? "Mandant konnte nicht geöffnet werden.";
      router.push("/dashboard");
      router.refresh();
      return null;
    },
    [router]
  );

  const exitTenant = useCallback(async () => {
    const result = await stopImpersonation();
    if (!result.success) return result.message ?? "Zurückwechseln fehlgeschlagen.";
    router.push("/dashboard/admin/tenants");
    router.refresh();
    return null;
  }, [router]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      plan: tenant.plan,
      hasFeature: (key) => tenant.features[key] === true,
      isImpersonating,
      switchTenant,
      exitTenant,
    }),
    [tenant, isImpersonating, switchTenant, exitTenant]
  );
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant() muss innerhalb von <TenantProvider> verwendet werden.");
  return ctx;
}
