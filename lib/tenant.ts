import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Mandanten (Kunden) und ihre Pakete. Welche Features ein Paket enthält, steht
// hier; einzelne Abweichungen pro Mandant in tenants.features (JSONB), z. B.
// {"whatsapp": true}. Schema: supabase/sql/multi-tenancy.sql.

export type PlanKey = "standard" | "plus" | "super";
export type TenantFeatureKey = "calls" | "notifications" | "whatsapp";

export const PLAN_LABELS: Record<PlanKey, string> = {
  standard: "Standard",
  plus: "Plus",
  super: "Super",
};

export const TENANT_FEATURE_LABELS: Record<TenantFeatureKey, string> = {
  calls: "CRM-Telefonie / Anrufe",
  notifications: "Benachrichtigungen (E-Mail-Versand & Logs)",
  whatsapp: "WhatsApp-Versand",
};

export const PLAN_FEATURES: Record<PlanKey, Record<TenantFeatureKey, boolean>> = {
  standard: { calls: false, notifications: false, whatsapp: false },
  plus: { calls: false, notifications: true, whatsapp: false },
  super: { calls: true, notifications: true, whatsapp: true },
};

export type TenantInfo = {
  // null = Mandanten-Schema noch nicht eingerichtet (SQL nicht ausgeführt)
  id: string | null;
  name: string;
  plan: PlanKey;
  features: Record<TenantFeatureKey, boolean>;
};

function resolveFeatures(plan: PlanKey, overrides: unknown): Record<TenantFeatureKey, boolean> {
  const features = { ...PLAN_FEATURES[plan] };
  if (overrides && typeof overrides === "object") {
    for (const key of Object.keys(features) as TenantFeatureKey[]) {
      const value = (overrides as Record<string, unknown>)[key];
      if (typeof value === "boolean") features[key] = value;
    }
  }
  return features;
}

// Solange multi-tenancy.sql nicht ausgeführt ist, verhält sich die App wie bisher
// (ein Mandant mit allen Features) — nichts geht verloren.
const LEGACY_TENANT: TenantInfo = {
  id: null,
  name: "Standard-Mandant",
  plan: "super",
  features: { ...PLAN_FEATURES.super },
};

// Mandant des eingeloggten Nutzers (RLS liefert nur den eigenen). Pro Request gecacht.
export const getCurrentTenant = cache(async (): Promise<TenantInfo> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tenants").select("id, name, plan, features").limit(1).maybeSingle();
  if (error || !data) {
    if (error && !/tenants/.test(error.message)) console.error("getCurrentTenant error:", error.message);
    return LEGACY_TENANT;
  }
  const plan = (["standard", "plus", "super"].includes(data.plan) ? data.plan : "standard") as PlanKey;
  return { id: data.id, name: data.name, plan, features: resolveFeatures(plan, data.features) };
});

export function tenantHasFeature(tenant: Pick<TenantInfo, "features">, key: TenantFeatureKey): boolean {
  return tenant.features[key] === true;
}

// Ist das Feature im Paket des aktuellen Kunden enthalten und freigeschaltet?
export async function hasFeature(key: TenantFeatureKey): Promise<boolean> {
  return tenantHasFeature(await getCurrentTenant(), key);
}

// Mandanten-ID für Service-Role-Abfragen (die RLS umgehen und daher selbst
// filtern müssen). null = Schema noch nicht eingerichtet -> kein Filter.
export async function currentTenantId(): Promise<string | null> {
  return (await getCurrentTenant()).id;
}

// Hängt den Mandantenfilter an eine Service-Role-Abfrage, sofern Mandanten aktiv sind.
// (Bewusst schwach typisiert: die Supabase-Builder-Generics sprengen sonst den Typchecker.)
export function scopeToTenant<Q>(query: Q, tenantId: string | null): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tenantId ? (query as any).eq("tenant_id", tenantId) : query;
}

// Seiten-Guard: fehlt das Feature im Paket -> Dashboard mit "Upgrade erforderlich".
export async function requireTenantFeature(key: TenantFeatureKey): Promise<void> {
  if (!(await hasFeature(key))) redirect(`/dashboard?upgrade=${key}`);
}
