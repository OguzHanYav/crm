"use client";

import Link from "next/link";
import { useSipPhone, type SipStatus } from "@/components/phone/SipPhoneProvider";

const VIEW: Record<SipStatus, { dot: string; text: string }> = {
  loading: { dot: "bg-muted-foreground animate-pulse", text: "Status wird geprüft…" },
  connecting: { dot: "bg-warning animate-pulse", text: "Telefon verbindet…" },
  registered: { dot: "bg-success", text: "Telefon bereit" },
  error: { dot: "bg-danger", text: "Telefon nicht verfügbar" },
  disabled: { dot: "bg-muted-foreground", text: "Telefonie nicht eingerichtet" },
};

// Status der Browser-Telefonie + zugewiesene Rufnummer des Nutzers.
export default function DashboardPhoneCard({
  assignedNumber,
}: {
  assignedNumber: { number: string; label: string | null } | null;
}) {
  const sip = useSipPhone();
  const status: SipStatus = sip?.status ?? "loading";
  const view = VIEW[status];
  const activeCall = sip?.call && sip.call.status !== "ended" ? sip.call : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Telefon</h2>
        <Link href="/dashboard/anrufe" className="text-xs font-medium text-accent hover:underline">
          Anrufe →
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${view.dot}`} />
        <span className="text-sm font-medium text-foreground">{view.text}</span>
      </div>
      {sip?.statusMessage && <p className="mt-1 text-xs text-muted-foreground">{sip.statusMessage}</p>}

      <dl className="mt-4 rounded-xl bg-muted/40 px-3 py-2.5">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Meine Rufnummer</dt>
        <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
          {assignedNumber ? assignedNumber.number : "Keine Nummer zugewiesen"}
          {assignedNumber?.label && <span className="font-normal text-muted-foreground"> · {assignedNumber.label}</span>}
        </dd>
      </dl>

      {activeCall && (
        <p className="mt-3 text-xs font-medium text-accent">
          Laufendes Gespräch: {activeCall.label || activeCall.number}
        </p>
      )}
    </section>
  );
}
