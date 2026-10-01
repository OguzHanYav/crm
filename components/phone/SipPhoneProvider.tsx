"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { UA, RTCSessionEvent } from "jssip/lib/UA";
import type { RTCSession, EndEvent, PeerConnectionEvent } from "jssip/lib/RTCSession";
import type { DTMF_TRANSPORT } from "jssip/lib/Constants";
import type { SipClientConfig, SipConfigResponse } from "@/lib/sip/types";
import { toDialTarget } from "@/lib/sip/phone-number";

// Browser-Telefonie über JsSIP/WebRTC. Der Browser verbindet sich per WSS mit der
// eigenen Telefonanlage (Asterisk) und meldet sich dort mit der persönlichen
// Nebenstelle des Mitarbeiters an; die Anlage leitet externe Anrufe über den
// SIP-Trunk weiter. Architektur & Einrichtung: docs/telefonie/README.md.
//
// Ist (noch) keine Leitung konfiguriert, liefert /api/sip/config enabled:false und
// der Provider bleibt inaktiv — CallLink fällt dann auf normale tel:-Links zurück.

export type SipStatus = "loading" | "disabled" | "connecting" | "registered" | "error";

export type ActiveCall = {
  id: string;
  direction: "outgoing" | "incoming";
  number: string;
  label: string | null;
  status: "dialing" | "ringing" | "active" | "ended";
  startedAt: number | null;
  muted: boolean;
  endMessage: string | null;
};

type SipPhoneContextValue = {
  status: SipStatus;
  statusMessage: string | null;
  call: ActiveCall | null;
  // true, wenn der Browser die Wiedergabe blockiert hat (Autoplay-Policy) —
  // das Widget zeigt dann einen "Ton aktivieren"-Button (User-Geste).
  audioBlocked: boolean;
  startCall: (phone: string, label?: string | null) => void;
  answer: () => void;
  hangup: () => void;
  toggleMute: () => void;
  sendDtmf: (tone: string) => void;
  unlockAudio: () => void;
  dismissCall: () => void;
};

const SipPhoneContext = createContext<SipPhoneContextValue | null>(null);

export function useSipPhone() {
  return useContext(SipPhoneContext);
}

// JsSIP wartet vor dem Senden des INVITE, bis ALLE ICE-Kandidaten gesammelt sind —
// mit nicht erreichbaren STUN/TURN-Servern oder vielen Netzwerk-Interfaces kann das
// 10–40 s dauern. Nach dem ersten Kandidaten geben wir daher nach kurzer Zeit frei.
const ICE_GATHERING_TIMEOUT_MS = 1500;
// Wie lange "Besetzt"/"Gespräch beendet" nach dem Auflegen sichtbar bleibt.
const ENDED_DISPLAY_MS = 4000;

function endMessage(cause: string | undefined): string {
  switch (cause) {
    case "Busy":
      return "Besetzt";
    case "Rejected":
      return "Abgelehnt";
    case "Unavailable":
      return "Nicht erreichbar";
    case "Not Found":
      return "Nummer nicht gefunden";
    case "Address Incomplete":
      return "Nummer unvollständig";
    case "No Answer":
      return "Keine Antwort";
    case "Canceled":
      return "Abgebrochen";
    case "User Denied Media Access":
      return "Kein Mikrofon-Zugriff – bitte im Browser erlauben (Schloss-Symbol in der Adressleiste).";
    case "Connection Error":
    case "Request Timeout":
      return "Keine Verbindung zur Telefonanlage";
    case "WebRTC Error":
    case "RTP Timeout":
    case "Bad Media Description":
      return "Audio-Verbindung fehlgeschlagen (Firewall/TURN prüfen)";
    case "Incompatible SDP":
      return "Kein gemeinsamer Audio-Codec";
    case "Authentication Error":
      return "Anmeldung abgelehnt";
    default:
      return "Gespräch beendet";
  }
}

async function fetchSipConfig(): Promise<SipClientConfig | null> {
  try {
    const res = await fetch("/api/sip/config", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as SipConfigResponse;
    return json.enabled ? json.config : null;
  } catch {
    return null;
  }
}

// Einfacher Klingelton per WebAudio (kein Audio-Asset nötig). Ohne vorherige
// Nutzerinteraktion kann der Browser ihn blockieren — dann bleibt nur die
// visuelle Anzeige im Widget, der Anruf selbst funktioniert trotzdem.
function createRingtone() {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function ring() {
    if (!ctx) return;
    // Zweiklang 440 + 480 Hz wie ein klassisches Freizeichen, 1,2 s an / 1,8 s aus.
    for (const freq of [440, 480]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    }
  }

  return {
    start() {
      try {
        ctx = new AudioContext();
        void ctx.resume().catch(() => {});
        ring();
        timer = setInterval(ring, 3000);
      } catch {
        ctx = null;
      }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}

export function SipPhoneProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode
  // false = Telefonie für diesen Nutzer gesperrt (Feature-Freigabe) -> keine Verbindung.
  enabled?: boolean
}) {
  const [status, setStatus] = useState<SipStatus>("loading");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const uaRef = useRef<UA | null>(null);
  const configRef = useRef<SipClientConfig | null>(null);
  const sessionRef = useRef<RTCSession | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playRemoteAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.srcObject) return;
    audio
      .play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  }, []);

  const attachRemoteAudio = useCallback(
    (pc: RTCPeerConnection) => {
      pc.addEventListener("track", (event) => {
        const audio = audioRef.current;
        if (!audio || event.track.kind !== "audio") return;
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        playRemoteAudio();
      });
    },
    [playRemoteAudio]
  );

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }, []);

  const updateCall = useCallback((sessionId: string, patch: Partial<ActiveCall>) => {
    setCall((prev) => (prev && prev.id === sessionId ? { ...prev, ...patch } : prev));
  }, []);

  // Verdrahtet alle Ereignisse einer (ein- oder ausgehenden) Sitzung mit dem UI-State.
  const wireSession = useCallback(
    (session: RTCSession) => {
      sessionRef.current = session;
      const id = session.id;

      session.on("peerconnection", (e) => attachRemoteAudio(e.peerconnection));

      const scheduledReady = new WeakSet<() => void>();
      session.on("icecandidate", ({ ready }) => {
        if (scheduledReady.has(ready)) return;
        scheduledReady.add(ready);
        setTimeout(ready, ICE_GATHERING_TIMEOUT_MS);
      });

      session.on("progress", () => updateCall(id, { status: "ringing" }));
      session.on("accepted", () => {
        stopRingtone();
        updateCall(id, { status: "active", startedAt: Date.now() });
      });
      session.on("muted", () => updateCall(id, { muted: true }));
      session.on("unmuted", () => updateCall(id, { muted: false }));

      const finish = (e: EndEvent) => {
        stopRingtone();
        if (sessionRef.current === session) sessionRef.current = null;
        if (audioRef.current) audioRef.current.srcObject = null;
        setAudioBlocked(false);
        updateCall(id, { status: "ended", endMessage: endMessage(e.cause) });
        if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
        endedTimerRef.current = setTimeout(() => {
          setCall((prev) => (prev && prev.id === id ? null : prev));
        }, ENDED_DISPLAY_MS);
      };
      session.on("ended", finish);
      session.on("failed", finish);
    },
    [attachRemoteAudio, stopRingtone, updateCall]
  );

  // Einmalig: Konfiguration laden, bei der Telefonanlage registrieren.
  useEffect(() => {
    let cancelled = false;
    let ua: UA | null = null;
    const stopOnUnload = () => ua?.stop();

    (async () => {
      if (!enabled) {
        setStatus("disabled");
        return;
      }
      const config = await fetchSipConfig();
      if (cancelled) return;
      if (!config) {
        setStatus("disabled");
        return;
      }
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setStatusMessage("Browser-Telefonie benötigt HTTPS (Mikrofon-Zugriff ist sonst gesperrt).");
        return;
      }

      configRef.current = config;
      // Dynamischer Import: JsSIP landet nur im Bundle, wenn Telefonie aktiv ist,
      // und läuft garantiert nur im Browser.
      const JsSIP = await import("jssip");
      if (cancelled) return;

      ua = new JsSIP.UA({
        sockets: [new JsSIP.WebSocketInterface(config.wssUrl)],
        uri: config.uri,
        authorization_user: config.authorizationUser,
        password: config.password,
        ha1: config.ha1,
        realm: config.realm,
        display_name: config.displayName,
        register: true,
        register_expires: 300,
        session_timers: false,
        user_agent: "CRM-WebRTC",
      });

      ua.on("connecting", () => setStatus((s) => (s === "registered" ? s : "connecting")));
      ua.on("disconnected", () => {
        setStatus("connecting");
        setStatusMessage("Verbindung zur Telefonanlage unterbrochen – verbinde neu…");
      });
      ua.on("registered", () => {
        setStatus("registered");
        setStatusMessage(null);
      });
      ua.on("unregistered", () => setStatus("connecting"));
      ua.on("registrationFailed", (e) => {
        setStatus("error");
        setStatusMessage(
          e.cause === "Authentication Error"
            ? "Anmeldung an der Telefonanlage abgelehnt – Zugangsdaten der Nebenstelle prüfen."
            : `Registrierung fehlgeschlagen (${e.cause ?? "unbekannt"}).`
        );
      });

      ua.on("newRTCSession", (e: RTCSessionEvent) => {
        // Ausgehende Sitzungen werden bereits in startCall verdrahtet.
        if ((e.originator as string) !== "remote") return;
        const session = e.session;

        // Nur ein Gespräch gleichzeitig: weitere Anrufer bekommen "besetzt".
        if (sessionRef.current) {
          session.terminate({ status_code: 486, reason_phrase: "Busy Here" });
          return;
        }

        const identity = session.remote_identity;
        if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
        setCall({
          id: session.id,
          direction: "incoming",
          number: identity?.uri?.user ?? "Unbekannt",
          label: identity?.display_name || null,
          status: "ringing",
          startedAt: null,
          muted: false,
          endMessage: null,
        });
        wireSession(session);
        ringtoneRef.current = createRingtone();
        ringtoneRef.current.start();
      });

      window.addEventListener("pagehide", stopOnUnload);
      ua.start();
      uaRef.current = ua;
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", stopOnUnload);
      ringtoneRef.current?.stop();
      ua?.stop();
      uaRef.current = null;
    };
  }, [wireSession, enabled]);

  const startCall = useCallback(
    async (phone: string, label?: string | null) => {
      const ua = uaRef.current;
      let config = configRef.current;
      if (!ua || !config || !ua.isRegistered()) return;
      if (sessionRef.current) {
        alert("Es läuft bereits ein Gespräch. Bitte zuerst auflegen.");
        return;
      }

      const target = toDialTarget(phone, config.defaultCountryCode);
      if (!target) return;

      // Zeitlich begrenzte TURN-Zugangsdaten ggf. vor dem Anruf erneuern.
      if (config.expiresAt && config.expiresAt - Date.now() < 60_000) {
        const fresh = await fetchSipConfig();
        if (fresh) configRef.current = config = fresh;
      }

      if (endedTimerRef.current) clearTimeout(endedTimerRef.current);

      try {
        const session = ua.call(`sip:${target}@${config.domain}`, {
          mediaConstraints: { audio: true, video: false },
          pcConfig: { iceServers: config.iceServers },
          rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
          // Muss VOR dem Anlegen der RTCPeerConnection registriert sein — die
          // entsteht synchron innerhalb von ua.call().
          eventHandlers: { peerconnection: (e: PeerConnectionEvent) => attachRemoteAudio(e.peerconnection) },
        });
        setCall({
          id: session.id,
          direction: "outgoing",
          number: target,
          label: label ?? null,
          status: "dialing",
          startedAt: null,
          muted: false,
          endMessage: null,
        });
        wireSession(session);
      } catch (err) {
        console.error("SIP call failed:", err);
        alert("Anruf konnte nicht gestartet werden.");
      }
    },
    [attachRemoteAudio, wireSession]
  );

  const answer = useCallback(() => {
    const session = sessionRef.current;
    const config = configRef.current;
    if (!session || !config || session.direction !== "incoming" || session.isEstablished()) return;
    stopRingtone();
    session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: config.iceServers },
    });
    // Klick auf "Annehmen" ist eine User-Geste -> Wiedergabe ist hier erlaubt.
    playRemoteAudio();
  }, [playRemoteAudio, stopRingtone]);

  const hangup = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.isEnded()) return;
    // Eingehend & noch nicht angenommen = Ablehnen mit "besetzt".
    if (session.direction === "incoming" && !session.isEstablished()) {
      session.terminate({ status_code: 486, reason_phrase: "Busy Here" });
    } else {
      session.terminate();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.isEstablished()) return;
    if (session.isMuted().audio) session.unmute({ audio: true });
    else session.mute({ audio: true });
  }, []);

  const sendDtmf = useCallback((tone: string) => {
    const session = sessionRef.current;
    if (!session?.isEstablished()) return;
    // RFC 2833/4733 im Audiostrom (Asterisk-Standard dtmf_mode=rfc4733) statt SIP INFO.
    session.sendDTMF(tone, { transportType: "RFC2833" as DTMF_TRANSPORT });
  }, []);

  const dismissCall = useCallback(() => {
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    setCall((prev) => (prev?.status === "ended" ? null : prev));
  }, []);

  const value = useMemo<SipPhoneContextValue>(
    () => ({
      status,
      statusMessage,
      call,
      audioBlocked,
      startCall: (phone, label) => void startCall(phone, label),
      answer,
      hangup,
      toggleMute,
      sendDtmf,
      unlockAudio: playRemoteAudio,
      dismissCall,
    }),
    [status, statusMessage, call, audioBlocked, startCall, answer, hangup, toggleMute, sendDtmf, playRemoteAudio, dismissCall]
  );

  return (
    <SipPhoneContext.Provider value={value}>
      {children}
      {/* Gesprächs-Audio der Gegenseite. autoPlay + playsInline für iOS/Safari. */}
      <audio ref={audioRef} autoPlay playsInline hidden />
    </SipPhoneContext.Provider>
  );
}
