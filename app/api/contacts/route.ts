import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { Contact, ContactSortKey, SortDir } from "@/app/(dashboard)/dashboard/kontakte/types";

// KEIN `export const runtime = "edge"` hier: Next.js 16.3.4 markiert die Edge
// Runtime für Route Handler als deprecated (Build-Warnung: "The Edge Runtime is
// deprecated. You can use the 'nodejs' runtime instead" — siehe
// node_modules/next/dist/build/warn-about-edge-runtime.js). Läuft daher mit der
// Standard-Node.js-Runtime, die auf Vercel mit Fluid Compute ebenfalls
// wiederverwendete/warme Instanzen bekommt, ohne die API-Einschränkungen der
// Edge Runtime. Details dazu im Chat.
const DEFAULT_LIMIT = 50;

const SORTABLE_COLUMNS: Record<ContactSortKey, string> = {
  name: "first_name",
  company: "company",
  country: "country",
  email: "email",
  phone: "phone",
  address: "address",
  industry: "industry",
  status: "status",
  createdAt: "created_at",
};

// Ersetzt das veraltete getContacts aus kontakte/actions.ts (siehe Kommentar
// dort) — dieselbe Query-Logik wie data.ts's getContacts, nur als Route
// Handler statt Server Action, damit ContactsTable.tsx per fetch() darauf
// zugreifen kann.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? "0") || 0;
  const limit = Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT;
  const q = searchParams.get("q") ?? undefined;
  const sortKey = (searchParams.get("sortKey") as ContactSortKey | null) ?? null;
  const sortDir: SortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";

  const label = `[perf] /api/contacts limit=${limit} offset=${offset}`;
  console.time(label);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.timeEnd(label);
    return NextResponse.json({ success: false, message: "Nicht angemeldet." }, { status: 401 });
  }

  let query = supabase
    .from("contacts")
    .select(
      `
      id, first_name, last_name, email, phone, company, country, address, industry, status, notes, created_at,
      deals ( id, created_at, stage_id, stage:deal_stages!stage_id ( id, name, color ) )
      `
    );

  const ascending = sortDir === "asc";
  if (sortKey && SORTABLE_COLUMNS[sortKey]) {
    query = query.order(SORTABLE_COLUMNS[sortKey], { ascending });
    if (sortKey === "name") {
      query = query.order("last_name", { ascending });
    }
  } else {
    query = query.order("created_at", { ascending: false });
  }
  // Sekundäres Sortierkriterium "id": stabiler Tiebreaker für range()-Pagination
  // (siehe getContacts in data.ts für denselben Grund).
  query = query.order("id", { ascending: true });

  if (q && q.trim().length > 0) {
    const term = q.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  console.timeEnd(label);

  if (error) {
    console.error("/api/contacts error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const contacts = (data ?? []).map((row: any) => {
    const deals = Array.isArray(row.deals) ? row.deals : row.deals ? [row.deals] : [];
    const latestDeal = [...deals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const stageRaw = latestDeal?.stage;
    const currentStage = stageRaw ? (Array.isArray(stageRaw) ? stageRaw[0] : stageRaw) : null;

    const { deals: _deals, ...contact } = row;
    return { ...contact, currentStage: currentStage ?? null };
  }) as Contact[];

  return NextResponse.json({ success: true, data: contacts });
}
