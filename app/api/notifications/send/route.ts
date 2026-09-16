import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { sendNotificationSchema } from "@/lib/validation/notifications";
import { createJob } from "@/lib/services/notification-queue";

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

  const { contactIds, type, emailPayload, whatsappPayload } = parsed.data;

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
