import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { jobIdParamSchema } from "@/lib/validation/notifications";
import { getNotificationJobDetail, getNotificationJobItems } from "@/app/(dashboard)/dashboard/notifications/data";
import { currentUserCanUseFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Nicht angemeldet." }, { status: 401 });
  }

  if (!(await currentUserCanUseFeature("notifications"))) {
    return NextResponse.json({ success: false, message: "Keine Berechtigung." }, { status: 403 });
  }

  const { jobId: rawJobId } = await context.params;
  const paramResult = jobIdParamSchema.safeParse({ jobId: rawJobId });

  if (!paramResult.success) {
    return NextResponse.json({ success: false, message: "Ungültige Job-ID." }, { status: 400 });
  }

  const { jobId } = paramResult.data;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Number(searchParams.get("offset") ?? "0") || 0;

  const [job, { items, total }] = await Promise.all([
    getNotificationJobDetail(jobId),
    getNotificationJobItems(jobId, { status, limit, offset }),
  ]);

  if (!job) {
    return NextResponse.json({ success: false, message: "Job nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ success: true, job, items, total });
}
