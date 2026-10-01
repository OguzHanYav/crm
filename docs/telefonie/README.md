# Browser-Telefonie (JsSIP + WebRTC + eigener SIP-Trunk)

Mitarbeiter klicken im CRM auf eine Telefonnummer, und der Anruf läuft direkt im Browser über die eigene SIP-Leitung. Dafür braucht es keine App und keinen SaaS-Dienst.

> **Status:** Der CRM-Code ist fertig und inaktiv, solange `SIP_ENABLED` nicht `true` ist. Bis dahin bleiben Telefonnummern normale `tel:`-Links. Die Telefonanlage (Asterisk) liegt fertig konfiguriert unter `deploy/asterisk/`.

---

## 1. Die wichtigste Erkenntnis vorweg

**Ein reiner SIP-Trunk lässt sich nicht direkt aus dem Browser ansprechen.** Das betrifft easybell, sipgate trunking und die meisten österreichischen Anbieter gleichermaßen.

| Browser (WebRTC) spricht … | SIP-Trunk spricht … |
|---|---|
| SIP über **WebSocket (WSS)** | SIP über **UDP/TCP/TLS** (Port 5060/5061) |
| Audio **DTLS-SRTP** (Verschlüsselung ist Pflicht) | Audio **RTP** (unverschlüsselt) oder SDES-SRTP |
| **ICE** für den Verbindungsaufbau | kein ICE |
| Codecs Opus, G.711 | G.711 (alaw/ulaw), teils G.722 |

Dazwischen braucht es deshalb einen **WebRTC-Gateway**: eine kleine eigene Telefonanlage. Hier ist das **Asterisk** (Open Source, kostenlos) auf einem günstigen Linux-Server (ein VPS ab ca. 4 €/Monat reicht für ein kleines Team).

Das ist auch **aus Sicherheitsgründen die richtige Architektur**. Selbst wenn ein Anbieter WSS anböte, müssten sonst die Trunk-Zugangsdaten in jeden Browser. Wer sie aus den Entwicklertools kopiert, telefoniert auf Ihre Kosten in alle Welt.

---

## 2. Architektur

```
┌──────────────────────────── Browser (Mitarbeiter) ────────────────────────────┐
│  CRM (Next.js)                                                               │
│  ├─ CallLink (Tabelle: Klick auf Nummer)                                     │
│  ├─ SipPhoneProvider (JsSIP-UA, Registrierung, Anrufe, Audio)                │
│  └─ PhoneWidget (Anruf-Fenster: Auflegen, Stumm, Tastatur, Annehmen)         │
└───────┬───────────────────────────────────────────────┬──────────────────────┘
        │ ① HTTPS GET /api/sip/config                   │ ② WSS (SIP-Signalisierung)
        │   (Supabase-Login nötig)                      │ ③ DTLS-SRTP (Audio, UDP)
        ▼                                               ▼
┌───────────────────────────┐          ┌──────────────────────────────────────────┐
│ CRM-Backend (Vercel)      │          │ Telefonanlage (eigener Linux-Server)     │
│ app/api/sip/config        │          │ nginx :443 (TLS)  →  Asterisk :8088/ws   │
│ liest SIP_* aus der .env: │          │ Asterisk: Nebenstellen 1001, 1002, …     │
│ nur die NEBENSTELLE des   │          │ Dialplan: Sperrliste, 1 Gespräch/Person  │
│ eingeloggten Mitarbeiters │          │ Trunk-Zugangsdaten NUR HIER (asterisk.env)│
└───────────────────────────┘          └───────────────────┬──────────────────────┘
                                                           │ ④ SIP (UDP 5060) + RTP
                                                           ▼
                                              ┌──────────────────────────┐
                                              │ SIP-Anbieter (Trunk)     │ → Telefonnetz
                                              └──────────────────────────┘
```

**Ablauf eines Anrufs:**

1. Beim Laden des Dashboards holt der Browser über `/api/sip/config` die Zugangsdaten **seiner eigenen Nebenstelle**. Ohne gültigen Supabase-Login gibt es nur 401.
2. JsSIP baut eine WSS-Verbindung zu `wss://pbx.example.de/ws` auf und registriert sich als z. B. `1001`. Das Widget zeigt dann „Telefon bereit“.
3. Ein Klick auf eine Nummer löst mehrere Schritte aus:
   - Die Nummer wird zu E.164 normalisiert (`0172 123…` → `+49172123…`).
   - JsSIP fragt nach dem Mikrofon und sendet `INVITE sip:+49172…@pbx.example.de`.
4. Asterisk prüft die Sperrliste, setzt die Absendernummer und ruft über den Trunk an. Das Audio läuft Browser ⇄ Asterisk (DTLS-SRTP) ⇄ Anbieter (RTP).

### Wo liegen welche Zugangsdaten?

| Geheimnis | Ort | Erreicht den Browser? |
|---|---|---|
| **SIP-Trunk** (Benutzer/Passwort des Anbieters) | nur `deploy/asterisk/asterisk.env` auf dem PBX-Server | **nein, nie** |
| Nebenstellen-Passwort je Mitarbeiter | `asterisk.env` (PBX) + `SIP_ACCOUNTS` in der CRM-`.env` (Vercel) | nur als **HA1-Hash** (wenn `SIP_REALM` gesetzt ist), nur für den eingeloggten Mitarbeiter, nur im Arbeitsspeicher |
| TURN-Secret | CRM-`.env` + coturn | nein. Der Browser bekommt ein **selbst ablaufendes** TURN-Passwort. |

Dass eine Nebenstelle im Browser landet, lässt sich prinzipiell nicht vermeiden, denn JsSIP muss sich anmelden. Der mögliche Schaden bleibt trotzdem klein:

- Die Nebenstelle ist nur für diesen einen Mitarbeiter gültig und lässt sich jederzeit durch ein neues Passwort sperren.
- Sonderrufnummern (0900, 0137, 118xx, 0180 sowie AT-Mehrwertnummern) sind im Dialplan gesperrt.
- Pro Nebenstelle ist nur **ein** externes Gespräch gleichzeitig möglich. Das verhindert massenhafte Anrufe über eine gekaperte Nebenstelle.
- Scheidet ein Mitarbeiter aus, entfernen Sie ihn aus `SIP_ACCOUNTS` und `PBX_WEBRTC_USERS`.

---

## 3. Netzwerk & Sicherheit

### Warum WSS (Secure WebSocket) Pflicht ist
- **Browser verlangen es.** Mikrofonzugriff (`getUserMedia`) gibt es nur in einem *Secure Context* (HTTPS). Eine HTTPS-Seite darf keine unverschlüsselte `ws://`-Verbindung öffnen, weil der Browser das als Mixed Content blockiert. Einzige Ausnahme ist `localhost` beim Entwickeln.
- Über die WebSocket-Verbindung laufen die **SIP-Anmeldung** und die **gewählten Nummern**. Unverschlüsselt könnte jeder im selben WLAN mitlesen und Anmeldedaten abgreifen.
- Das Zertifikat muss **öffentlich gültig** sein, also Let's Encrypt. Selbstsignierte Zertifikate lehnen Browser bei WebSockets **stillschweigend** ab: Es erscheint keine Warnseite, die Verbindung schlägt einfach fehl.

### STUN/TURN richtig einstellen
- **Asterisk steht mit öffentlicher IP im Internet** (VPS). Der Browser baut die Verbindung dann *von innen nach außen* auf, und das klappt hinter fast jedem Router. Dafür reicht **STUN** (`SIP_STUN_URLS`, vorbelegt mit Google-STUN).
- **Hat der Server selbst eine private IP** (z. B. hinter einer Cloud-Firewall), gehört dessen öffentliche IP in `PBX_PUBLIC_IP`. Sonst nennt Asterisk dem Browser und dem Anbieter die interne Adresse, und es gibt kein Audio.
- **TURN** ist nur nötig, wenn Mitarbeiter in Netzen sitzen, die ausgehendes UDP sperren (Konzern-WLAN, manche Hotels). Das typische Symptom: Der Anruf baut sich auf, aber nach ca. 30 s bricht er ohne Ton ab (Ursache „RTP Timeout“/„WebRTC Error“). Die Lösung ist **coturn** auf demselben Server:
  ```ini
  # /etc/turnserver.conf
  listening-port=3478
  tls-listening-port=5349
  realm=pbx.example.de
  use-auth-secret
  static-auth-secret=<langes Zufalls-Secret = SIP_TURN_SECRET im CRM>
  cert=/etc/letsencrypt/live/pbx.example.de/fullchain.pem
  pkey=/etc/letsencrypt/live/pbx.example.de/privkey.pem
  no-multicast-peers
  denied-peer-ip=10.0.0.0-10.255.255.255
  denied-peer-ip=172.16.0.0-172.31.255.255
  denied-peer-ip=192.168.0.0-192.168.255.255
  ```
  Im CRM:
  ```
  SIP_TURN_URLS=turn:pbx.example.de:3478?transport=udp,turns:pbx.example.de:5349?transport=tcp
  SIP_TURN_SECRET=<gleiches Secret>
  ```
  Die API-Route erzeugt daraus für jeden Mitarbeiter ein **zeitlich begrenztes** TURN-Passwort (TURN-REST-Verfahren). Das Secret selbst verlässt den Server nie.

### Autoplay-Policy & Mikrofon
- Browser spielen Ton erst ab, wenn der Nutzer mit der Seite interagiert hat. **Ausgehende Anrufe** starten per Klick und sind damit unproblematisch.
- Bei **eingehenden Anrufen** ist die Lage anders. Hat der Mitarbeiter seit dem Laden noch nirgends geklickt, bleibt der Klingelton stumm. Das Widget zeigt den Anruf trotzdem an. Der Klick auf „Annehmen“ zählt als Nutzergeste, danach läuft das Gesprächsaudio.
- Scheitert `audio.play()` trotzdem, zeigt das Widget „Ton ist blockiert – hier klicken“.
- Den Mikrofonzugriff fragt der Browser beim **ersten Anruf** ab. Wird er verweigert, zeigt das Widget einen Hinweis, wie man ihn über das Schloss-Symbol in der Adressleiste wieder erlaubt.

---

## 4. Code-Überblick

| Datei | Aufgabe |
|---|---|
| `app/api/sip/config/route.ts` | Backend-Route: prüft Login, liefert Nebenstellen-Config (`no-store`) |
| `lib/sip/server-config.ts` | liest `SIP_*`-Variablen, berechnet HA1 und TURN-Zugangsdaten (nur Server) |
| `lib/sip/types.ts` | Datenvertrag Server ⇄ Browser |
| `lib/sip/phone-number.ts` | Nummer → E.164 (`0172…` → `+49172…`) |
| `components/phone/SipPhoneProvider.tsx` | JsSIP: Registrierung, Anrufen, Auflegen, Annehmen, Stumm, DTMF, Audio, Klingelton |
| `components/phone/PhoneWidget.tsx` | Anruf-Fenster unten rechts |
| `components/phone/CallLink.tsx` | Telefonnummer in Tabellen/Detailansicht: Browser-Anruf oder `tel:` als Fallback |
| `app/(dashboard)/layout.tsx` | bindet Provider + Widget ins Dashboard ein (Registrierung bleibt beim Seitenwechsel bestehen) |
| `deploy/asterisk/` | Telefonanlage: Dockerfile, Konfig-Vorlagen, nginx, Compose für lokal/produktiv |

Details zum Verhalten:

- **Auflegen/Beenden:** `hangup()` beendet laufende Gespräche (`BYE`) und bricht ausgehende Anrufe ab, die noch klingeln (`CANCEL`). Eingehende Anrufe lehnt es mit „Besetzt“ ab (`486`). Wenn die Gegenseite auflegt oder etwas scheitert, zeigt das Widget den Grund (Besetzt, Keine Antwort, Kein Mikrofon …) vier Sekunden lang an.
- **Beschleunigter Rufaufbau:** JsSIP wartet normalerweise, bis *alle* Netzwerkadressen (ICE-Kandidaten) gesammelt sind. Das dauert mitunter 10–40 s. Der Provider startet den Anruf deshalb 1,5 s nach der ersten gefundenen Adresse.
- **Ein Gespräch gleichzeitig:** Ein zweiter eingehender Anruf bekommt „Besetzt“.

---

## 5. Jetzt schon testen – ohne SIP-Leitung

> **Ausführliche Schritt-für-Schritt-Anleitung** (Docker-Installation auf macOS, alle Tests, Fehlerbehebung, Checkliste): [LOKALER-TEST.md](LOKALER-TEST.md)

Die gesamte Strecke Browser → WSS → Asterisk → Audio lässt sich **lokal** testen. Nur der letzte Schritt zum Anbieter fehlt.

**Voraussetzung:** Docker Desktop.

```bash
cd deploy/asterisk
cp asterisk.env.example asterisk.env        # PBX_TRUNK_* leer lassen
docker compose -f docker-compose.local.yml up --build
```

In der CRM-`.env.local` (lokal ist `ws://` auf localhost erlaubt):
```
SIP_ENABLED=true
SIP_WSS_URL=ws://localhost:8088/ws
SIP_DOMAIN=localhost
SIP_REALM=asterisk
SIP_ACCOUNTS={"ihre-login-email@firma.de":{"extension":"1001","password":"bitte-aendern-1001"},"kollege@firma.de":{"extension":"1002","password":"bitte-aendern-1002"}}
```

Dann `npm run dev` starten, einloggen und die folgenden Tests durchgehen:

| Test | So geht's | Prüft |
|---|---|---|
| Registrierung | Unten rechts steht „Telefon bereit“ (grün) | WSS, Zugangsdaten, HA1/Realm |
| **Echo-Test** | Einen Kontakt mit Telefonnummer `600` anlegen und anklicken; Sie hören sich selbst | Mikrofon, Lautsprecher, DTLS-SRTP, ICE |
| Ansage | Nummer `601` | Audio Server → Browser |
| Intern / eingehend | Zweiter Browser (oder Inkognito) mit Login `kollege@…`, dann `1002` anrufen | Klingelton, Annehmen/Ablehnen, beide Richtungen |
| Tastatur (DTMF) | Während `600` „Tasten“ drücken | RFC-4733-DTMF |

Weitere Werkzeuge:

- **Fehlersuche Browser:** `chrome://webrtc-internals` zeigt ICE-Kandidaten, ob Audio fließt, und die Codecs. JsSIP-Logs lassen sich in der Browser-Konsole mit `localStorage.debug = "JsSIP:*"` einschalten (danach neu laden).
- **Fehlersuche Asterisk:**
  ```bash
  docker compose -f docker-compose.local.yml exec asterisk asterisk -rvvv
  ```
  In der Asterisk-Konsole: `pjsip show contacts` (wer ist registriert?) und `pjsip set logger on` (alle SIP-Nachrichten).
- **Öffentliche Test-SIP-Konten** (früher iptel.org, sip2sip.info u. a.) sind unzuverlässig oder abgeschaltet. Vor allem testen sie nicht Ihre eigene Anlage, deshalb ist der lokale Asterisk die bessere Wahl.

> Hinweis: Die Docker-Einrichtung wurde nicht in einer echten Docker-Umgebung ausgeführt, sondern nach Asterisk-Dokumentation erstellt. Sollte beim ersten Start etwas haken, hilft die Asterisk-Konsole oben.

---

## 6. Produktiv-Server einrichten (einmalig, ca. 1 Stunde)

1. **VPS** mit öffentlicher IPv4 mieten (Ubuntu 24.04, 1 vCPU/2 GB reicht) und Docker installieren.
2. **DNS:** A-Record `pbx.ihre-domain.de` auf die Server-IP setzen.
3. **Firewall** (Hosting-Panel + `ufw`):
   | Port | Protokoll | Von | Wofür |
   |---|---|---|---|
   | 443 | TCP | überall | WSS (nginx) |
   | 80 | TCP | überall | Let's-Encrypt-Erneuerung |
   | 10000–20000 | UDP | überall | Audio (RTP/SRTP) |
   | 5060 | UDP | **nur IP-Bereiche des SIP-Anbieters** | SIP-Trunk |
   | 3478, 5349 | UDP/TCP | überall | nur mit coturn |
   | 8088 | TCP | **nicht öffnen** | nur intern für nginx |
4. **nginx + Zertifikat:** siehe `deploy/asterisk/nginx-pbx.conf` (enthält die Befehle).
5. **Asterisk:**
   ```bash
   cd deploy/asterisk
   cp asterisk.env.example asterisk.env   # Nebenstellen eintragen
   docker compose up -d --build
   ```
6. **CRM (Vercel → Settings → Environment Variables):**
   - `SIP_ENABLED=true`
   - `SIP_WSS_URL=wss://pbx.ihre-domain.de/ws`
   - `SIP_DOMAIN=pbx.ihre-domain.de`
   - `SIP_REALM=asterisk`
   - `SIP_ACCOUNTS=…`
   - danach neu deployen.
7. **fail2ban** gegen Passwort-Rateversuche auf Port 5060 einrichten (Filter `asterisk`).

Ab hier funktionieren alle internen Tests (600, 601, Mitarbeiter untereinander) bereits produktiv.

---

## 7. Checkliste: nach dem Kauf der SIP-Leitung

Diese Werte stehen im Kundenportal des Anbieters, meist unter „SIP-Trunk“, „SIP-Zugangsdaten“ oder „Telefonanlage verbinden“. Die Bezeichnungen variieren:

| Beim Anbieter heißt es z. B. … | Eintragen in `asterisk.env` |
|---|---|
| Registrar / SIP-Server / Proxy / Domain | `PBX_TRUNK_HOST` (und `PBX_TRUNK_REGISTRAR`, falls abweichend) |
| SIP-ID / Benutzername / Rufnummernblock-Benutzer | `PBX_TRUNK_USER` |
| Auth-/Authentifizierungs-Benutzer (falls separat) | `PBX_TRUNK_AUTH_USER` |
| SIP-Passwort | `PBX_TRUNK_PASSWORD` |
| Ihre Rufnummer (für die Rufnummernanzeige) | `PBX_TRUNK_CALLERID` |
| Rufnummernformat abgehend (`0049…` oder `+49…`) | `PBX_TRUNK_DIAL_PREFIX` (`00` oder `+`) |

Danach auf dem PBX-Server:
```bash
cd deploy/asterisk && docker compose up -d --force-recreate
docker compose exec asterisk asterisk -rx "pjsip show registrations"   # muss "Registered" zeigen
```

Dann im CRM der Reihe nach testen:

- [ ] Eigenes Handy anrufen: klingelt es, und wird die richtige Nummer angezeigt?
- [ ] Beide Richtungen hörbar? Falls nicht, siehe Fallstricke → Einweg-Audio.
- [ ] Gespräch länger als 60 s halten: bricht es nicht nach 30–32 s ab?
- [ ] Die Firmennummer vom Handy aus anrufen: klingeln alle eingeloggten Browser?
- [ ] Eine gesperrte Nummer testen (z. B. 0900…): Wird der Anruf abgewiesen?
- [ ] Im Anbieter-Portal ein **Kostenlimit / Auslandssperre** setzen (zusätzlicher Schutz).

Die CRM-Seite muss dafür **nicht** angepasst werden, denn die Trunk-Zugangsdaten gehören nur auf die Anlage.

---

## 8. Fallstricke

| Symptom | Ursache | Lösung |
|---|---|---|
| Widget bleibt bei „Telefon verbindet…“ | WSS nicht erreichbar: falsches/abgelaufenes Zertifikat, Port 443 zu, nginx ohne `Upgrade`-Header | `wss://…/ws` mit einem WebSocket-Tester prüfen; `nginx -t`; Zertifikat mit `certbot certificates` prüfen |
| „Anmeldung abgelehnt“ | Passwort in `SIP_ACCOUNTS` ≠ `PBX_WEBRTC_USERS`, oder `SIP_REALM` ≠ `PBX_REALM` | beide Stellen abgleichen |
| Anruf baut auf, **kein Ton / Abbruch nach ~30 s** | RTP-Ports (UDP 10000–20000) zu, falsche `PBX_PUBLIC_IP`, oder Mitarbeiter hinter UDP-Sperre | Firewall prüfen; `PBX_PUBLIC_IP` setzen; coturn einrichten |
| **Einweg-Audio** zum Anbieter | Asterisk nennt dem Anbieter eine private IP | `PBX_PUBLIC_IP` setzen (ergänzt `external_media_address` und `external_signaling_address`) |
| Trunk registriert nicht („Rejected“/403) | Auth-User ≠ SIP-ID, falscher Registrar, oder der Anbieter erwartet TLS/Port 5061 | Anbieter-Doku prüfen; `pjsip set logger on` |
| Anruf zum Anbieter mit 403/404 | falsches Nummernformat | `PBX_TRUNK_DIAL_PREFIX` von `00` auf `+` stellen oder umgekehrt |
| Falsche/keine Rufnummernanzeige | Anbieter erwartet die Nummer in P-Asserted-Identity oder im From-Header in einem bestimmten Format | `PBX_TRUNK_CALLERID` im Format des Anbieters (oft `49…`) |
| 10–40 s bis es klingelt | ICE-Sammeln hängt an nicht erreichbarem STUN/TURN | ist bereits abgefangen (1,5 s); TURN-URLs prüfen |
| Kein Mikrofon-Popup, sofort Fehler | Seite nicht über HTTPS aufgerufen, oder Mikrofon zuvor blockiert | nur über `https://` nutzen; Berechtigung über das Schloss-Symbol zurücksetzen |
| Eingehende Anrufe klingeln nicht hörbar | Autoplay-Policy (noch keine Interaktion auf der Seite) | einmal irgendwo auf die Seite klicken; der Anruf wird trotzdem angezeigt |
| Zertifikat läuft ab → Telefonie tot | Let's-Encrypt-Erneuerung klappt nicht (Port 80 zu) | Port 80 offen lassen; `certbot renew --dry-run` |
| Hohe Rechnung / Betrug | gestohlene Zugangsdaten | Sperrliste im Dialplan, 1 Gespräch pro Nebenstelle, fail2ban, Kostenlimit beim Anbieter, 5060 nur für Anbieter-IPs |

---

## 9. Bewusst (noch) nicht umgesetzt

- **Anrufprotokoll:** Gespräche werden nicht automatisch in `call_logs` (Seite „Anrufe“) eingetragen. Ein guter nächster Schritt wäre, nach jedem Gespräch Dauer und Ergebnis zu speichern.
- **Anrufer-Erkennung:** Bei eingehenden Anrufen erscheint die Nummer, nicht der Kontaktname aus dem CRM.
- **Gesprächsaufzeichnung:** In DE/AT nur mit Einwilligung aller Beteiligten erlaubt, daher weggelassen.
- **Weiterleiten/Halten/Konferenz:** JsSIP und Asterisk können das (`refer`, `hold`), im Widget ist es noch nicht vorhanden.
