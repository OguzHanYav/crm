import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { sendNotificationSchema } from "@/lib/validation/notifications";
import { createJob } from "@/lib/services/notification-queue";
import { getCurrentTenant, PLAN_LABELS, tenantHasFeature } from "@/lib/tenant";
import { getNotificationSettings } from "@/lib/services/notification-settings";

// Legt nur noch den Job + die Job-Items an und antwortet sofort — der
// eigentliche Versand läuft asynchron über app/api/notifications/jobs/[jobId]/
// process/route.ts (vom Frontend getriggert), damit dieser Request bei 100+
// Kontakten nicht am Vercel-Timeout scheitert. Siehe lib/services/
// notification-queue.ts für die Begründung der Queue-Architektur.
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Nicht angemeldet." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sendNotificationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Ungültige Anfrage.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { contactIds: requestedIds, type, emailPayload, whatsappPayload } = parsed.data;

  // Paket-Prüfung: Versand gehört zum Feature "notifications", WhatsApp zusätzlich zu "whatsapp".
  const tenant = await getCurrentTenant();
  if (!tenantHasFeature(tenant, "notifications")) {
    return NextResponse.json(
      { success: false, message: `Upgrade erforderlich: Benachrichtigungen sind im Paket ${PLAN_LABELS[tenant.plan]} nicht enthalten.` },
      { status: 403 }
    );
  }
  if (type !== "email" && !tenantHasFeature(tenant, "whatsapp")) {
    return NextResponse.json(
      { success: false, message: `Upgrade erforderlich: WhatsApp-Versand ist im Paket ${PLAN_LABELS[tenant.plan]} nicht enthalten.` },
      { status: 403 }
    );
  }

  // E-Mail nur mit eigenem Absender des Kunden — früh ablehnen statt jeden Kontakt
  // einzeln als "fehlgeschlagen" zu markieren.
  if (type !== "whatsapp") {
    const settings = await getNotificationSettings(tenant.id);
    if (!settings.configured) {
      return NextResponse.json(
        { success: false, message: settings.reason ?? "Kein E-Mail-Absender eingerichtet." },
        { status: 400 }
      );
    }
  }

  // Die Queue liest Kontakte per Service-Role (ohne RLS) — daher nur Kontakte
  // übernehmen, die der Nutzer per Session (RLS, eigener Mandant) sehen darf.
  const contactIds: string[] = [];
  for (let i = 0; i < requestedIds.length; i += 100) {
    const { data, error } = await supabase.from("contacts").select("id").in("id", requestedIds.slice(i, i + 100));
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
    contactIds.push(...(data ?? []).map((r: { id: string }) => r.id));
  }
  if (contactIds.length === 0) {
    return NextResponse.json({ success: false, message: "Keine gültigen Empfänger ausgewählt." }, { status: 400 });
  }

  try {
    const { jobId, totalItems } = await createJob({
      contactIds,
      channel: type,
      emailPayload,
      whatsappPayload,
      userId: user.id,
    });

    return NextResponse.json({ success: true, jobId, totalItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job konnte nicht erstellt werden.";
    console.error("/api/notifications/send error:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
