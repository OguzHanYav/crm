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
//
// Dieselbe Konstante existiert (bewusst separat, kein Cross-Import aus dem
// data.ts-Modul, das react cache()-gewrappte Exports enthält) auch in
// kontakte/data.ts und ContactsTable.tsx.
const CONTACTS_PAGE_SIZE = 100;

// Supabase liefert pro Query max. 1000 Rows (PostgREST-Limit) — beim "Alle
// laden"-Pfad wird das per Range-Loop in 1000er-Blöcken umgangen.
const SUPABASE_MAX_ROWS_PER_QUERY = 1000;

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

const CONTACTS_SELECT = `
  id, first_name, last_name, email, phone, company, country, address, industry, status, notes, created_at,
  deals ( id, created_at, stage_id, stage:deal_stages!stage_id ( id, name, color ) )
`;

function mapContactRows(data: any[]): Contact[] {
  return (data ?? []).map((row: any) => {
    const deals = Array.isArray(row.deals) ? row.deals : row.deals ? [row.deals] : [];
    const latestDeal = [...deals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const stageRaw = latestDeal?.stage;
    const currentStage = stageRaw ? (Array.isArray(stageRaw) ? stageRaw[0] : stageRaw) : null;

    const { deals: _deals, ...contact } = row;
    return { ...contact, currentStage: currentStage ?? null };
  }) as Contact[];
}

function applySort(query: any, sortKey: ContactSortKey | null, sortDir: SortDir) {
  const ascending = sortDir === "asc";
  if (sortKey && SORTABLE_COLUMNS[sortKey]) {
    query = query.order(SORTABLE_COLUMNS[sortKey], { ascending });
    if (sortKey === "name") {
      query = query.order("last_name", { ascending });
    }
  } else {
    query = query.order("created_at", { ascending: false });
  }
  // Sekundäres Sortierkriterium "id": stabiler Tiebreaker für range()-Pagination.
  return query.order("id", { ascending: true });
}

type ParsedFilters = {
  q?: string;
  status?: string;
  company?: string;
  from?: string;
  to?: string;
  dealStatus?: string;
  event?: string;
};

function parseFilters(searchParams: URLSearchParams): ParsedFilters {
  return {
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    company: searchParams.get("company") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    dealStatus: searchParams.get("dealStatus") ?? undefined,
    event: searchParams.get("event") ?? undefined,
  };
}

// dealStatus/event werden (wie schon zuvor in getContacts/data.ts) entgegen-
// genommen, aber aktuell nicht auf eine DB-Spalte gemappt — kein Deal-/Call-Join
// an dieser Stelle vorhanden. q/status/company/from/to werden angewendet.
function applyFilters(query: any, filters: ParsedFilters) {
  if (filters.q && filters.q.trim().length > 0) {
    const term = filters.q.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
    );
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.company && filters.company.trim().length > 0) {
    query = query.ilike("company", `%${filters.company.trim()}%`);
  }
  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("created_at", `${filters.to}T23:59:59.999`);
  }
  return query;
}

// Ersetzt das veraltete getContacts aus kontakte/actions.ts (siehe Kommentar
// dort) — dieselbe Query-Logik wie data.ts's getContacts, nur als Route
// Handler statt Server Action, damit ContactsTable.tsx per fetch() darauf
// zugreifen kann.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Nicht angemeldet." }, { status: 401 });
  }

  const sortKey = (searchParams.get("sortKey") as ContactSortKey | null) ?? null;
  const sortDir: SortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";

  // ?all=true: ignoriert page/offset/limit, lädt ALLE zu den aktuellen Filtern
  // passenden Kontakte in 1000er-Blöcken (PostgREST-Limit pro Query).
  if (searchParams.get("all") === "true") {
    const filters = parseFilters(searchParams);
    const label = "[perf] /api/contacts?all=true";
    console.time(label);

    const allRows: any[] = [];
    let rangeStart = 0;

    while (true) {
      let query = supabase.from("contacts").select(CONTACTS_SELECT);
      query = applyFilters(query, filters);
      query = applySort(query, sortKey, sortDir);
      query = query.range(rangeStart, rangeStart + SUPABASE_MAX_ROWS_PER_QUERY - 1);

      const { data, error } = await query;

      if (error) {
        console.timeEnd(label);
        console.error("/api/contacts?all=true error:", error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      allRows.push(...(data ?? []));

      if (!data || data.length < SUPABASE_MAX_ROWS_PER_QUERY) break;
      rangeStart += SUPABASE_MAX_ROWS_PER_QUERY;
    }

    console.timeEnd(label);

    const contacts = mapContactRows(allRows);
    return NextResponse.json({ contacts, total: contacts.length });
  }

  const offset = Number(searchParams.get("offset") ?? "0") || 0;
  const limit = Number(searchParams.get("limit") ?? String(CONTACTS_PAGE_SIZE)) || CONTACTS_PAGE_SIZE;
  const q = searchParams.get("q") ?? undefined;

  const label = `[perf] /api/contacts limit=${limit} offset=${offset}`;
  console.time(label);

  let query = supabase.from("contacts").select(CONTACTS_SELECT);
  query = applySort(query, sortKey, sortDir);

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

  return NextResponse.json({ success: true, data: mapContactRows(data ?? []) });
}
