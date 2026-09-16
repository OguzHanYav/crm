import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getServiceRoleClient } from "@/lib/supabase/admin";

// Braucht Node's "crypto" für den konstant-zeitigen Secret-Vergleich — kein Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const provided = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return false;

  return timingSafeEqual(provided, expectedBuffer);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const admin = getServiceRoleClient();
  const { data, error } = await admin.rpc("cleanup_old_notification_jobs");

  if (error) {
    console.error("cron/cleanup-jobs error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: (data as number | null) ?? 0 });
}
