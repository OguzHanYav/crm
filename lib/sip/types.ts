// Gemeinsamer Vertrag zwischen /api/sip/config (Server) und SipPhoneProvider (Browser).
// Enthält NUR die Zugangsdaten der persönlichen WebRTC-Nebenstelle des eingeloggten
// Mitarbeiters — niemals die SIP-Trunk-Zugangsdaten (die liegen ausschließlich auf
// der Telefonanlage, siehe docs/telefonie/README.md).
export type SipClientConfig = {
  wssUrl: string;
  // z. B. "sip:1001@pbx.example.de"
  uri: string;
  domain: string;
  authorizationUser: string;
  displayName: string;
  // Entweder HA1 (bevorzugt, kein Klartext-Passwort im Browser) ODER Passwort.
  ha1?: string;
  realm?: string;
  password?: string;
  iceServers: RTCIceServer[];
  // Landesvorwahl für nationale Nummern ("0172…" -> "+49172…"), ohne "+".
  defaultCountryCode: string;
  // Unix-ms: danach sind die TURN-Zugangsdaten abgelaufen -> Config neu laden.
  expiresAt: number | null;
};

export type SipConfigResponse =
  | { enabled: true; config: SipClientConfig }
  | { enabled: false; reason: "not_configured" | "no_account" | "feature_disabled" };
