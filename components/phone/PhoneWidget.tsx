"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSipPhone, type ActiveCall } from "./SipPhoneProvider";

const DTMF_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function callStatusText(call: ActiveCall, now: number) {
  switch (call.status) {
    case "dialing":
      return "Wählt…";
    case "ringing":
      return call.direction === "incoming" ? "Eingehender Anruf" : "Klingelt…";
    case "active":
      return call.startedAt ? `Verbunden · ${formatDuration(now - call.startedAt)}` : "Verbunden";
    case "ended":
      return call.endMessage ?? "Gespräch beendet";
  }
}

// Schwebendes Telefon-Widget (unten rechts): Registrierungsstatus + laufendes Gespräch.
export default function PhoneWidget() {
  const sip = useSipPhone();
  const pathname = usePathname();
  const [showKeypad, setShowKeypad] = useState(false);
  const call = sip?.call ?? null;
  const now = useNow(call?.status === "active");

  useEffect(() => {
    if (call?.status !== "active") setShowKeypad(false);
  }, [call?.status]);

  if (!sip || sip.status === "loading" || sip.status === "disabled") return null;

  if (!call) {
    // Ruhezustand-Badge nur auf der Anrufe-Seite. Ein laufender oder eingehender
    // Anruf (unten) bleibt auf jeder Seite sichtbar — sonst ließe er sich nicht
    // annehmen oder auflegen.
    if (!pathname.startsWith("/dashboard/anrufe")) return null;
    const dot =
      sip.status === "registered" ? "bg-success" : sip.status === "error" ? "bg-danger" : "bg-warning animate-pulse";
    const text =
      sip.status === "registered"
        ? "Telefon bereit"
        : sip.status === "error"
          ? "Telefon nicht verfügbar"
          : "Telefon verbindet…";
    return (
      <div
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-card"
        title={sip.statusMessage ?? text}
      >
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {text}
      </div>
    );
  }

  const isIncomingRinging = call.direction === "incoming" && call.status === "ringing";
  const isEnded = call.status === "ended";

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-4 shadow-lg">
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {call.direction === "incoming" ? "Eingehend" : "Ausgehend"}
        </p>
        <p className="truncate text-base font-semibold text-foreground">{call.label || call.number}</p>
        {call.label && <p className="truncate text-sm text-muted-foreground">{call.number}</p>}
        <p className={`mt-1 text-sm ${isEnded ? "text-muted-foreground" : "text-accent"}`}>{callStatusText(call, now)}</p>
      </div>

      {sip.audioBlocked && !isEnded && (
        <button
          type="button"
          onClick={sip.unlockAudio}
          className="ring-focus mb-3 w-full rounded-xl bg-warning/15 px-3 py-2 text-sm font-medium text-warning"
        >
          Ton ist blockiert – hier klicken zum Aktivieren
        </button>
      )}

      {showKeypad && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {DTMF_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => sip.sendDtmf(key)}
              className="ring-focus min-h-[40px] rounded-xl border border-border text-base font-medium text-foreground hover:bg-muted/50"
            >
              {key}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {isIncomingRinging ? (
          <>
            <button
              type="button"
              onClick={sip.hangup}
              className="ring-focus min-h-[40px] flex-1 rounded-xl border border-danger/40 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
            >
              Ablehnen
            </button>
            <button
              type="button"
              onClick={sip.answer}
              className="ring-focus min-h-[40px] flex-1 rounded-xl bg-success px-3 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              Annehmen
            </button>
          </>
        ) : isEnded ? (
          <button
            type="button"
            onClick={sip.dismissCall}
            className="ring-focus min-h-[40px] flex-1 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Schließen
          </button>
        ) : (
          <>
            {call.status === "active" && (
              <>
                <button
                  type="button"
                  onClick={sip.toggleMute}
                  className={`ring-focus min-h-[40px] flex-1 rounded-xl border px-2 py-2 text-sm font-medium ${
                    call.muted ? "border-warning bg-warning/15 text-warning" : "border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  {call.muted ? "Stumm an" : "Stumm"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeypad((v) => !v)}
                  className="ring-focus min-h-[40px] flex-1 rounded-xl border border-border px-2 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
                >
                  Tasten
                </button>
              </>
            )}
            <button
              type="button"
              onClick={sip.hangup}
              className="ring-focus min-h-[40px] flex-1 rounded-xl bg-danger px-3 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              Auflegen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
