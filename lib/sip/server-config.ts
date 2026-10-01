import { createHash, createHmac } from "node:crypto";
import type { SipClientConfig } from "./types";

// Nur serverseitig importieren (API-Route) — liest geheime Umgebungsvariablen.
// Alle Variablen sind in .env.example dokumentiert.

type SipAccount = { extension: string; password: string; displayName?: string };

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isSipConfigured(): boolean {
  return env("SIP_ENABLED") === "true" && Boolean(env("SIP_WSS_URL") && env("SIP_DOMAIN") && env("SIP_ACCOUNTS"));
}

// SIP_ACCOUNTS ist ein JSON-Objekt: Schlüssel = E-Mail ODER Supabase-User-ID des
// Mitarbeiters, Wert = seine Nebenstelle auf der Telefonanlage, z. B.
// {"max@firma.de":{"extension":"1001","password":"geheim"}}
function findAccount(userId: string, email: string | undefined): SipAccount | null {
  let accounts: Record<string, SipAccount>;
  try {
    accounts = JSON.parse(env("SIP_ACCOUNTS"));
  } catch {
    console.error("SIP_ACCOUNTS ist kein gültiges JSON.");
    return null;
  }

  const normalized = new Map(Object.entries(accounts).map(([key, value]) => [key.trim().toLowerCase(), value]));
  const account = normalized.get(userId.toLowerCase()) ?? (email ? normalized.get(email.toLowerCase()) : undefined);
  if (!account?.extension || !account?.password) return null;
  return account;
}

// Zeitlich begrenzte TURN-Zugangsdaten nach dem "TURN REST API"-Verfahren, das
// coturn mit `use-auth-secret` + `static-auth-secret` versteht: Das geteilte
// Secret bleibt auf dem Server, der Browser bekommt nur ein Passwort, das nach
// SIP_TURN_TTL_SECONDS von selbst ungültig wird.
function buildIceServers(userId: string): { iceServers: RTCIceServer[]; expiresAt: number | null } {
  const iceServers: RTCIceServer[] = [];

  const stunUrls = splitList(env("SIP_STUN_URLS"));
  if (stunUrls.length > 0) iceServers.push({ urls: stunUrls });

  const turnUrls = splitList(env("SIP_TURN_URLS"));
  const turnSecret = env("SIP_TURN_SECRET");
  let expiresAt: number | null = null;

  if (turnUrls.length > 0 && turnSecret) {
    const ttlSeconds = Number(env("SIP_TURN_TTL_SECONDS")) || 3600;
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiry}:${userId}`;
    const credential = createHmac("sha1", turnSecret).update(username).digest("base64");
    iceServers.push({ urls: turnUrls, username, credential });
    expiresAt = expiry * 1000;
  }

  return { iceServers, expiresAt };
}

export function buildSipClientConfig(user: {
  id: string;
  email?: string;
  displayName: string;
}): SipClientConfig | null {
  const account = findAccount(user.id, user.email);
  if (!account) return null;

  const domain = env("SIP_DOMAIN");
  const realm = env("SIP_REALM");
  const { iceServers, expiresAt } = buildIceServers(user.id);

  // Mit bekanntem Realm reicht JsSIP der HA1-Hash (MD5 aus user:realm:passwort) —
  // das Klartext-Passwort verlässt den Server dann nie. HA1 berechtigt zwar
  // ebenfalls zur Anmeldung an genau dieser Nebenstelle, ist aber nicht als
  // Passwort anderswo wiederverwendbar.
  const credentials = realm
    ? {
        realm,
        ha1: createHash("md5").update(`${account.extension}:${realm}:${account.password}`).digest("hex"),
      }
    : { password: account.password };

  return {
    wssUrl: env("SIP_WSS_URL"),
    uri: `sip:${account.extension}@${domain}`,
    domain,
    authorizationUser: account.extension,
    displayName: account.displayName || user.displayName,
    ...credentials,
    iceServers,
    defaultCountryCode: env("SIP_DEFAULT_COUNTRY_CODE").replace(/\D/g, "") || "49",
    expiresAt,
  };
}
