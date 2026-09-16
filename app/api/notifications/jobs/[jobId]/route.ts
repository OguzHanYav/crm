import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { jobIdParamSchema } from "@/lib/validation/notifications";
import { getJobStatus, getJobItems } from "@/lib/services/notification-queue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
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

  const [job, failedItems] = await Promise.all([getJobStatus(jobId), getJobItems(jobId, { status: "failed" })]);

  if (!job) {
    return NextResponse.json({ success: false, message: "Job nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ success: true, job, failedItems });
}
