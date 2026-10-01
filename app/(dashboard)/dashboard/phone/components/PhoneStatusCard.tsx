"use client";

import { useSipPhone, type SipStatus } from "@/components/phone/SipPhoneProvider";

const STATUS_VIEW: Record<SipStatus, { dot: string; title: string; text: string }> = {
  loading: { dot: "bg-muted-foreground animate-pulse", title: "Wird geprüft…", text: "Status der Telefonverbindung wird geladen." },
  connecting: { dot: "bg-warning animate-pulse", title: "Telefon verbindet…", text: "Verbindung zur Telefonanlage wird aufgebaut." },
  registered: { dot: "bg-success", title: "Telefonverbindung aktiv", text: "Dieser Browser ist an der Telefonanlage angemeldet und kann telefonieren." },
  error: { dot: "bg-danger", title: "Telefon nicht verfügbar", text: "Die Anmeldung an der Telefonanlage ist fehlgeschlagen." },
  disabled: { dot: "bg-muted-foreground", title: "Telefonie inaktiv", text: "Für diesen Account ist keine Nebenstelle hinterlegt." },
};

// Live-Status der Browser-Telefonie (aus dem globalen SipPhoneProvider).
export default function PhoneStatusCard({ sipConfigured }: { sipConfigured: boolean }) {
  const sip = useSipPhone();
  const status: SipStatus = sip?.status ?? "loading";
  const view = sipConfigured
    ? STATUS_VIEW[status]
    : { dot: "bg-muted-foreground", title: "Telefonie nicht eingerichtet", text: "SIP_ENABLED ist nicht aktiv — siehe docs/telefonie/README.md." };

  return (
    <section className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-soft">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${view.dot}`} />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{view.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{sip?.statusMessage ?? view.text}</p>
        {sip?.call && sip.call.status !== "ended" && (
          <p className="mt-1 text-xs font-medium text-accent">Laufendes Gespräch: {sip.call.label || sip.call.number}</p>
        )}
      </div>
    </section>
  );
}
