import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { jobIdParamSchema } from "@/lib/validation/notifications";
import { getNotificationSettings } from "@/lib/services/notification-settings";
import {
  acquireJobLock,
  releaseJobLock,
  getNextPendingItems,
  getJobPayload,
  processItem,
  updateJobCounters,
  markJobFailed,
} from "@/lib/services/notification-queue";
import { JOB_BATCH_SIZE } from "@/lib/constants/notifications";

// maxDuration = 300 (Vercel Pro) ist ein Sicherheitsnetz, kein Ziel: ein Batch
// von JOB_BATCH_SIZE (20) Items × ~1-2s (inkl. Retry-Puffer bei 429/5xx) bleibt
// normalerweise deutlich darunter. Bei Vercel Hobby wird maxDuration ohnehin
// hart auf 10s gekappt — dort JOB_BATCH_SIZE auf 5 reduzieren (siehe README/
// MANUAL SETUP), der Worker funktioniert sonst identisch, nur mit mehr Calls.
export const maxDuration = 300;
// Kein statisches Caching dieser Route — jeder Call muss den aktuellen
// Job-Zustand live aus der DB lesen/verändern.
export const dynamic = "force-dynamic";

// Warum Rekursion vom FRONTEND statt einer internen while-Schleife hier: eine
// interne Schleife über ALLE Items würde denselben Timeout-Problem wieder
// einführen, das die Queue eigentlich lösen soll (ein einzelner Request, der
// bei 1000 Kontakten Minuten läuft). Stattdessen verarbeitet dieser Call genau
// EINEN Batch und meldet "remaining" zurück — das Frontend entscheidet, ob und
// wann es erneut triggert (siehe SendNotificationModal.tsx Self-Trigger).
export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Nicht angemeldet." }, { status: 401 });
  }

  const { jobId: rawJobId } = await context.params;
  const paramResult = jobIdParamSchema.safeParse({ jobId: rawJobId });

  if (!paramResult.success) {
    return NextResponse.json({ success: false, message: "Ungültige Job-ID." }, { status: 400 });
  }

  const { jobId } = paramResult.data;

  // Verhindert, dass zwei parallele /process-Calls (z. B. der initiale Trigger
  // und ein Self-Trigger-Retry nach Tab-Wechsel) gleichzeitig dieselben
  // "pending"-Items laden und doppelt versenden.
  const lockAcquired = await acquireJobLock(jobId);
  if (!lockAcquired) {
    return NextResponse.json({ success: false, message: "Job wird bereits verarbeitet." }, { status: 409 });
  }

  try {
    const [settings, payload] = await Promise.all([getNotificationSettings(), getJobPayload(jobId)]);

    if (!payload) {
      await markJobFailed(jobId, "Job nicht gefunden.");
      return NextResponse.json({ success: false, message: "Job nicht gefunden." }, { status: 404 });
    }

    const items = await getNextPendingItems(jobId, JOB_BATCH_SIZE);

    // Sequenziell (nicht Promise.all) — respektiert Rate-Limits von Resend/Meta,
    // siehe Begründung in notification-queue.ts.
    for (const item of items) {
      await processItem(item, payload, settings);
    }

    const counters = await updateJobCounters(jobId);

    return NextResponse.json({ success: true, ...counters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unerwarteter Fehler bei der Job-Verarbeitung.";
    console.error("/api/notifications/jobs/[jobId]/process error:", message);
    await markJobFailed(jobId, message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  } finally {
    await releaseJobLock(jobId);
  }
}
