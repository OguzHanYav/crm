// Pakete und Paket-Features — reine Konstanten, auch in Client-Komponenten nutzbar
// (lib/tenant.ts ist serverseitig und re-exportiert alles von hier).

export type PlanKey = "standard" | "plus" | "super";
export type TenantFeatureKey = "calls" | "notifications" | "whatsapp";

export const PLAN_KEYS: PlanKey[] = ["standard", "plus", "super"];
export const TENANT_FEATURE_KEYS: TenantFeatureKey[] = ["calls", "notifications", "whatsapp"];

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

// Paket-Standard + Abweichungen aus tenants.features (nur boolesche Werte zählen).
export function resolveFeatures(plan: PlanKey, overrides: unknown): Record<TenantFeatureKey, boolean> {
  const features = { ...PLAN_FEATURES[plan] };
  if (overrides && typeof overrides === "object") {
    for (const key of TENANT_FEATURE_KEYS) {
      const value = (overrides as Record<string, unknown>)[key];
      if (typeof value === "boolean") features[key] = value;
    }
  }
  return features;
}

// Speichert nur Abweichungen vom Paket — so bleibt ein späterer Paketwechsel sinnvoll.
export function overridesFor(plan: PlanKey, features: Record<TenantFeatureKey, boolean>): Partial<Record<TenantFeatureKey, boolean>> {
  const overrides: Partial<Record<TenantFeatureKey, boolean>> = {};
  for (const key of TENANT_FEATURE_KEYS) {
    if (features[key] !== PLAN_FEATURES[plan][key]) overrides[key] = features[key];
  }
  return overrides;
}
