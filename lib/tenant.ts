import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Mandanten (Kunden) und ihre Pakete. Welche Features ein Paket enthält, steht
// hier; einzelne Abweichungen pro Mandant in tenants.features (JSONB), z. B.
// {"whatsapp": true}. Schema: supabase/sql/multi-tenancy.sql.

import { PLAN_FEATURES, resolveFeatures as resolvePlanFeatures, type PlanKey, type TenantFeatureKey } from "@/lib/plans";

export { PLAN_FEATURES, PLAN_LABELS, PLAN_KEYS, TENANT_FEATURE_KEYS, TENANT_FEATURE_LABELS, resolveFeatures } from "@/lib/plans";
export type { PlanKey, TenantFeatureKey } from "@/lib/plans";

export type TenantInfo = {
  // null = Mandanten-Schema noch nicht eingerichtet (SQL nicht ausgeführt)
  id: string | null;
  name: string;
  plan: PlanKey;
  features: Record<TenantFeatureKey, boolean>;
};

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
  return { id: data.id, name: data.name, plan, features: resolvePlanFeatures(plan, data.features) };
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

// Öffnet ein Super-Admin gerade einen Kunden? (Eintrag in admin_impersonation,
// siehe supabase/migrations/003_super_admin_impersonation.sql)
// Aktiv, sobald ein Impersonation-Eintrag existiert ODER der aktive Mandant vom
// Heimat-Mandanten (profiles.tenant_id) des Nutzers abweicht.
export const getImpersonation = cache(
  async (): Promise<{ active: boolean; tenantName: string | null; homeTenantId: string | null }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { active: false, tenantName: null, homeTenantId: null };

    const [{ data: impersonation }, { data: profile }, tenant] = await Promise.all([
      supabase.from("admin_impersonation").select("tenant_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle(),
      getCurrentTenant(),
    ]);
    const homeTenantId = (profile as { tenant_id?: string } | null)?.tenant_id ?? null;
    const differsFromHome = Boolean(tenant.id && homeTenantId && tenant.id !== homeTenantId);
    const hasEntry = Boolean(impersonation?.tenant_id && impersonation.tenant_id !== homeTenantId);
    return { active: differsFromHome || hasEntry, tenantName: tenant.name, homeTenantId };
  }
);

// Für INSERTs: tenant_id des aktiven Mandanten (bei Impersonation der geöffnete
// Kunde) explizit mitschreiben. Die DB setzt sie zusätzlich per Trigger und
// erzwingt sie per NOT NULL + RLS (WITH CHECK) — doppelte Absicherung.
// Vor der Mandanten-Migration (id = null) bleibt das Objekt leer.
export async function tenantFields(): Promise<{ tenant_id?: string }> {
  const id = await currentTenantId();
  return id ? { tenant_id: id } : {};
}
