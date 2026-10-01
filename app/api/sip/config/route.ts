import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildSipClientConfig, isSipConfigured } from "@/lib/sip/server-config";
import { currentUserCanUseFeature } from "@/lib/features";
import type { SipConfigResponse } from "@/lib/sip/types";

// Liefert dem eingeloggten Mitarbeiter die Zugangsdaten SEINER WebRTC-Nebenstelle
// (nie die des SIP-Trunks). Nicht cachebar: Antwort ist nutzerbezogen und enthält
// Zugangsdaten. Route Handler sind in Next 16 ohnehin nicht gecacht, der Header
// verhindert zusätzlich Browser-/Proxy-Caching.
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401, headers: NO_STORE });
  }

  // Solange keine SIP-Leitung eingerichtet ist, bleibt die Browser-Telefonie
  // einfach aus — die Tabellen fallen dann auf normale tel:-Links zurück.
  if (!isSipConfigured()) {
    return NextResponse.json<SipConfigResponse>({ enabled: false, reason: "not_configured" }, { headers: NO_STORE });
  }

  // Mitglieder bekommen Zugangsdaten nur, wenn ein Admin die Telefonie freigeschaltet hat.
  if (!(await currentUserCanUseFeature("calls"))) {
    return NextResponse.json<SipConfigResponse>({ enabled: false, reason: "feature_disabled" }, { headers: NO_STORE });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email || "CRM";

  const config = buildSipClientConfig({ id: user.id, email: user.email, displayName });
  if (!config) {
    return NextResponse.json<SipConfigResponse>({ enabled: false, reason: "no_account" }, { headers: NO_STORE });
  }

  return NextResponse.json<SipConfigResponse>({ enabled: true, config }, { headers: NO_STORE });
}
