import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getNotificationJobs } from "@/app/(dashboard)/dashboard/notifications/data";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Nicht angemeldet." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Number(searchParams.get("offset") ?? "0") || 0;
  const status = searchParams.get("status") ?? undefined;

  const { jobs, total } = await getNotificationJobs({ limit, offset, status });

  return NextResponse.json({ success: true, jobs, total });
}
