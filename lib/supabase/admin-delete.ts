import type { SupabaseClient } from "@supabase/supabase-js";

// Löschlogik für Admin-Aktionen (Aufrufer MUSS vorher isCurrentUserAdmin() prüfen).
// Abhängige Zeilen werden explizit zuerst gelöscht, weil nicht für alle
// Fremdschlüssel (notes, call_logs, deal_stage_history, deals.contact_id) ein
// ON DELETE CASCADE garantiert ist — sonst schlüge das Löschen am FK fehl.

// .in() landet in der URL — große ID-Listen daher in Blöcken senden.
const ID_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function deleteWhereIn(client: SupabaseClient, table: string, column: string, ids: string[]) {
  for (const idChunk of chunk(ids, ID_CHUNK_SIZE)) {
    const { error } = await client.from(table).delete().in(column, idChunk);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function deleteDealsWithDependents(client: SupabaseClient, dealIds: string[]) {
  if (dealIds.length === 0) return;
  await deleteWhereIn(client, "deal_stage_history", "deal_id", dealIds);
  await deleteWhereIn(client, "deals", "id", dealIds);
}

// Löscht Kontakte samt ihrer Deals, Notizen, Anrufe, Aktivitäten und Versand-Einträge.
export async function deleteContactsWithDependents(client: SupabaseClient, contactIds: string[]) {
  if (contactIds.length === 0) return;

  const dealIds: string[] = [];
  for (const idChunk of chunk(contactIds, ID_CHUNK_SIZE)) {
    const { data, error } = await client.from("deals").select("id").in("contact_id", idChunk);
    if (error) throw new Error(`deals: ${error.message}`);
    dealIds.push(...(data ?? []).map((d: { id: string }) => d.id));
  }

  await deleteDealsWithDependents(client, dealIds);
  for (const table of ["notes", "call_logs", "activities", "notification_job_items"]) {
    await deleteWhereIn(client, table, "contact_id", contactIds);
  }
  await deleteWhereIn(client, "contacts", "id", contactIds);
}
