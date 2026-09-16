import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { verifyResendSignature, type ResendWebhookEvent } from "@/lib/services/resend-webhook";

// Kein Edge-Runtime: die Signatur-Validierung braucht Node's "crypto"-Modul,
// das in der Edge-Runtime nicht (vollständig) verfügbar ist.
export const runtime = "nodejs";
// Kein statisches Caching — jeder Call muss frisch validiert und verarbeitet werden.
export const dynamic = "force-dynamic";

async function handleBounce(event: ResendWebhookEvent) {
  const admin = getServiceRoleClient();
  const email = event.data.to?.[0];
  if (!email) {
    console.warn("handleBounce: kein Empfänger im Event.");
    return;
  }

  const { data: contact, error } = await admin
    .from("contacts")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("handleBounce contact lookup error:", error.message);
    return;
  }

  if (!contact) {
    console.warn(`handleBounce: kein Kontakt mit E-Mail ${email} gefunden.`);
    return;
  }

  const reason = event.data.bounce?.message ?? "Unbekannter Bounce-Grund";

  const { error: updateError } = await admin
    .from("contacts")
    .update({
      email_opt_in: false,
      email_bounce_reason: reason,
      email_bounced_at: event.created_at,
    })
    .eq("id", contact.id);

  if (updateError) {
    console.error("handleBounce update error:", updateError.message);
    return;
  }

  const { error: activityError } = await admin.from("activities").insert({
    contact_id: contact.id,
    type: "email_bounced",
    description: `Bounce an ${email}: ${reason}`,
  });

  if (activityError) {
    console.error("handleBounce activity error:", activityError.message);
  }

  console.log(`Bounce für E-Mail verarbeitet: ${email}`);
}

async function handleComplaint(event: ResendWebhookEvent) {
  const admin = getServiceRoleClient();
  const email = event.data.to?.[0];
  if (!email) {
    console.warn("handleComplaint: kein Empfänger im Event.");
    return;
  }

  const { data: contact, error } = await admin
    .from("contacts")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("handleComplaint contact lookup error:", error.message);
    return;
  }

  if (!contact) {
    console.warn(`handleComplaint: kein Kontakt mit E-Mail ${email} gefunden.`);
    return;
  }

  // Complaint = Empfänger hat aktiv als Spam markiert — härtere Sperre als ein
  // Bounce, daher keine 30-Tage-Kulanz wie beim Bounce-Filter in createJob().
  const { error: updateError } = await admin
    .from("contacts")
    .update({
      email_opt_in: false,
      email_complained_at: event.created_at,
    })
    .eq("id", contact.id);

  if (updateError) {
    console.error("handleComplaint update error:", updateError.message);
    return;
  }

  const { error: activityError } = await admin.from("activities").insert({
    contact_id: contact.id,
    type: "email_complained",
    description: `Als Spam markiert: ${email}`,
  });

  if (activityError) {
    console.error("handleComplaint activity error:", activityError.message);
  }

  console.log(`Complaint für E-Mail verarbeitet: ${email}`);
}

export async function POST(request: NextRequest) {
  // request.text() statt request.json(): die Svix-Signatur wird über den
  // EXAKTEN Raw-Body gebildet — jede Re-Serialisierung (auch nur andere
  // Key-Reihenfolge) würde die Signaturprüfung brechen.
  const rawBody = await request.text();

  const { valid, error } = verifyResendSignature(rawBody, request.headers);
  if (!valid) {
    console.error("Resend webhook signature invalid:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "email.bounced":
        await handleBounce(event);
        break;
      case "email.complained":
        await handleComplaint(event);
        break;
      case "email.delivery_delayed":
        console.log("email.delivery_delayed:", event.data.email_id);
        break;
      default:
        return NextResponse.json({ ok: true, ignored: event.type });
    }
  } catch (err) {
    // Trotzdem 200: ein interner Fehler hier soll Resend nicht dazu bringen,
    // denselben Event endlos zu retryn (siehe Kommentar unten).
    console.error("Resend webhook handler error:", err);
  }

  // Immer 200 sobald die Signatur gültig war und das Event verarbeitet wurde —
  // auch wenn der Kontakt nicht gefunden wurde. Resend interpretiert 4xx/5xx als
  // "nicht zugestellt" und wiederholt den Call automatisch (mit Backoff), was
  // bei einem dauerhaft fehlenden Kontakt nur unnötige Retries erzeugen würde.
  return NextResponse.json({ ok: true });
}
