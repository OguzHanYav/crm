// Einstiegsphase für neue Kontakte: Jeder neu angelegte oder importierte Kontakt
// bekommt einen Deal in der Phase "Neuer Kunde". Fehlt die Phase im Mandanten,
// wird sie vor allen anderen Phasen angelegt.
//
// Standard: läuft mit der Session des Nutzers (RLS begrenzt auf den aktiven
// Mandanten). Mit `tenantId` (für Service-Role-Clients ohne RLS, z. B. Anlage
// im Inhaber-CRM aus der Kundenverwaltung) wird explizit auf diesen Mandanten
// gefiltert und geschrieben.
import { tenantFields } from "@/lib/tenant";

export const NEW_CUSTOMER_STAGE_NAME = "Neuer Kunde";
const NEW_CUSTOMER_STAGE_COLOR = "#2563EB";

export async function resolveNewCustomerStage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenantId?: string
): Promise<{ pipelineId: string; stageId: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (query: any) => (tenantId ? query.eq("tenant_id", tenantId) : query);
  const tenantColumns = tenantId ? { tenant_id: tenantId } : await tenantFields();

  // 1. Gibt es die Phase schon (in irgendeiner Pipeline des Mandanten)?
  const { data: existing } = await scoped(
    supabase.from("deal_stages").select("id, pipeline_id").ilike("name", NEW_CUSTOMER_STAGE_NAME)
  )
    .order("position", { ascending: true })
    .limit(1);
  if (existing?.[0]) return { pipelineId: existing[0].pipeline_id, stageId: existing[0].id };

  // 2. Pipeline bestimmen (bzw. anlegen, falls der Mandant noch keine hat).
  const { data: pipelines } = await scoped(supabase.from("pipelines").select("id"))
    .order("name", { ascending: true })
    .limit(1);
  let pipelineId: string | undefined = pipelines?.[0]?.id;
  if (!pipelineId) {
    const { data: created, error } = await supabase
      .from("pipelines")
      .insert({ name: "Standard-Pipeline", ...tenantColumns })
      .select("id")
      .single();
    if (error || !created) {
      console.error("resolveNewCustomerStage pipeline error:", error?.message);
      return null;
    }
    pipelineId = created.id;
  }

  // 3. Phase vor allen bestehenden Phasen anlegen.
  const { data: first } = await supabase
    .from("deal_stages")
    .select("position")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true })
    .limit(1);
  const position = first?.[0] ? Math.min(0, first[0].position - 1) : 0;

  const { data: stage, error: stageError } = await supabase
    .from("deal_stages")
    .insert({
      pipeline_id: pipelineId,
      name: NEW_CUSTOMER_STAGE_NAME,
      position,
      color: NEW_CUSTOMER_STAGE_COLOR,
      ...tenantColumns,
    })
    .select("id")
    .single();
  if (stageError || !stage) {
    console.error("resolveNewCustomerStage stage error:", stageError?.message);
    return null;
  }
  return { pipelineId: pipelineId as string, stageId: stage.id };
}
