"use client";

import { useSipPhone } from "./SipPhoneProvider";

// Telefonnummer in CRM-Tabellen: Ist die Browser-Telefonie registriert, startet ein
// Klick den Anruf direkt im Browser; sonst bleibt es ein normaler tel:-Link
// (z. B. solange noch keine SIP-Leitung eingerichtet ist).
export default function CallLink({
  phone,
  label,
  className = "",
  children,
}: {
  phone: string;
  label?: string | null;
  className?: string;
  // Optional eigener Inhalt (z. B. Button-Beschriftung) statt Icon + Nummer.
  children?: React.ReactNode;
}) {
  const sip = useSipPhone();
  const canCall = sip?.status === "registered";
  const busy = Boolean(sip?.call && sip.call.status !== "ended");

  return (
    <a
      href={`tel:${phone}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!canCall || !sip) return;
        e.preventDefault();
        sip.startCall(phone, label);
      }}
      title={canCall ? (busy ? "Es läuft bereits ein Gespräch" : `${phone} im Browser anrufen`) : undefined}
      className={`inline-flex max-w-full items-center gap-1.5 ${className}`}
    >
      {children ?? (canCall && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden>
          <path
            d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
      {!children && <span className="truncate">{phone}</span>}
    </a>
  );
}
