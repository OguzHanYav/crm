# Lokaler Test der Browser-Telefonie (ohne SIP-Leitung)

Diese Anleitung testet die komplette Strecke **Browser → WebSocket → Asterisk → Audio** auf Ihrem Mac. Sie brauchen dafür keine SIP-Leitung und keine öffentlichen Test-Accounts. Arbeiten Sie die Schritte der Reihe nach ab: Alle Befehle sind zum Kopieren gedacht, und jeder Schritt sagt, was Sie sehen sollten.

**Zeitbedarf:** ca. 45–60 Minuten, davon ca. 15 Minuten für die Docker-Installation.

---

## 0. Voraussetzungen (bereits geprüft)

| | Ihr Rechner | Status |
|---|---|---|
| Betriebssystem | macOS 15.6.1, Apple Silicon (arm64), 18 GB RAM | ✅ passt (Docker Desktop braucht macOS 13+) |
| Node.js | v20.20.0 | ✅ passt |
| Homebrew | installiert | ✅ |
| Docker | **nicht installiert** | ⏳ Schritt 1 |
| CRM lokal | `npm run dev` auf http://localhost:3000 | ✅ |

Außerdem brauchen Sie:

- **Chrome** (für die Diagnoseseite `chrome://webrtc-internals`).
- Ein **Headset oder Kopfhörer**. Ohne Kopfhörer koppeln Lautsprecher und Mikrofon zurück, und beim Echo-Test pfeift es.

> ⚠️ **Hinweis zur Datenbank:** Ihr lokales CRM nutzt die Supabase-Datenbank aus `.env.local`, vermutlich die echte. Die Testkontakte (`600`, `601`, `1002`) und der zweite Test-Benutzer landen also in den echten Daten. Benennen Sie sie deshalb eindeutig mit **„TEST …“** und löschen Sie sie am Ende wieder (Schritt 7).

---

## 1. Docker Desktop installieren (macOS, Apple Silicon)

### 1.1 Installieren

Im Terminal:

```bash
brew update
brew install --cask docker-desktop
open -a Docker
```

`brew update` ist nötig, weil Ihre Homebrew-Paketliste veraltet ist. Ohne das Update scheitert die Installation mit `Unexpected method 'postflight_steps'`.

Beim ersten Start:

1. Die Nutzungsbedingungen akzeptieren.
2. Die Anmeldung („Sign in“) können Sie überspringen: **„Continue without signing in“**.
3. Warten, bis das Wal-Symbol oben in der Menüleiste nicht mehr animiert ist und Docker Desktop „Engine running“ anzeigt (ca. 1 Minute).

**Alternative ohne Homebrew:** https://www.docker.com/products/docker-desktop/ → „Download for Mac – **Apple Silicon**“, dann die `.dmg` öffnen und Docker in „Programme“ ziehen.

### 1.2 Prüfen, ob Docker läuft

```bash
docker version
docker compose version
docker run --rm hello-world
```

Erwartet:

- `docker version` zeigt **Client** *und* **Server**. Fehlt der Server-Teil, läuft Docker Desktop nicht.
- `docker compose version` zeigt `Docker Compose version v2.x`.
- `hello-world` gibt „Hello from Docker!“ aus.

### 1.3 Fallstricke auf macOS

| Problem | Lösung |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop ist nicht gestartet: `open -a Docker`, ca. 1 Minute warten |
| `docker: command not found` nach der Installation | neues Terminal-Fenster öffnen, bzw. Docker Desktop einmal starten (legt die CLI-Links an) |
| Sehr langsam, Lüfter laut | Docker Desktop → Settings → Resources: 2 CPUs / 4 GB RAM reichen für diesen Test |
| VPN aktiv (Firmen-VPN) | kann lokale UDP-Ports stören. Für den Test ausschalten, falls es kein Audio gibt |
| **Lizenz** | Docker Desktop ist kostenlos für Firmen mit < 250 Mitarbeitern **und** < 10 Mio. $ Umsatz, sonst kostenpflichtig |
| Windows (nur zur Info) | Docker Desktop braucht dort WSL2 (`wsl --install`, Neustart). Die UDP-Portfreigaben verhalten sich wie auf dem Mac |

---

## 2. Asterisk lokal starten

### 2.1 Konfiguration anlegen

```bash
cd "/Users/oguzhanyavuz/Hüseyin-Tas/crm-lead-management/deploy/asterisk"
cp asterisk.env.example asterisk.env
```

**Für den lokalen Test müssen Sie in `asterisk.env` nichts ändern.** Die Vorgaben passen, und die `PBX_TRUNK_*`-Zeilen bleiben leer. Die Variablen bedeuten im lokalen Test:

| Variable | Wert im Test | Bedeutung |
|---|---|---|
| `PBX_WEBRTC_USERS` | `1001:bitte-aendern-1001:Mitarbeiter Eins;1002:bitte-aendern-1002:Mitarbeiter Zwei` | zwei Browser-Nebenstellen: Durchwahl, Passwort, Anzeigename. Die Passwörter müssen **exakt** zu `SIP_ACCOUNTS` im CRM passen (Schritt 3) |
| `PBX_REALM` | `asterisk` | Anmelde-Bereich, muss `SIP_REALM` im CRM entsprechen |
| `PBX_PUBLIC_IP` | leer | nur auf einem Server mit privater IP nötig |
| `PBX_STUN_ADDR` | leer | lokal nicht nötig |
| `PBX_TLS_CERT` / `PBX_TLS_KEY` | leer | lokal kein TLS (siehe 3.2) |
| `PBX_TRUNK_*` | **leer** | kein SIP-Trunk; externe Nummern sind dadurch nicht erreichbar, interne Tests schon |

Die folgenden Werte setzt `docker-compose.local.yml` automatisch, Sie müssen sie **nicht** eintragen:

- `PBX_HTTP_BIND=0.0.0.0` (WebSocket von außerhalb des Containers erreichbar)
- RTP-Ports 10000–10100
- `PBX_ICE_HOST_MAPPING`: sorgt dafür, dass der Browser die Audio-Ports über `127.0.0.1` findet
- `PBX_CONSOLE=true`: Asterisk-Ausgaben erscheinen im Terminal

### 2.2 Starten

```bash
docker compose -f docker-compose.local.yml up --build
```

- Der erste Build dauert **2–5 Minuten** (lädt Ubuntu und Asterisk). Spätere Starts dauern Sekunden.
- Erwartete Ausgabe:
  - zuerst `Asterisk-Konfiguration erzeugt: 2 Nebenstelle(n), Trunk: nicht konfiguriert`
  - danach Asterisk-Startmeldungen, am Ende `Asterisk Ready.`
- **Dieses Terminal offen lassen.** Hier sehen Sie später live, wie sich Browser anmelden und Anrufe laufen.
- Zum Beenden drücken Sie `Ctrl+C`. Alternativ in einem anderen Terminal: `docker compose -f docker-compose.local.yml down`.

Warnungen wie `WARNING[...] loader.c: Module 'xyz' could not be loaded` sind normal und unkritisch, solange am Ende `Asterisk Ready.` erscheint.

### 2.3 Prüfen, ob Asterisk läuft

In einem **zweiten** Terminal:

```bash
cd "/Users/oguzhanyavuz/Hüseyin-Tas/crm-lead-management/deploy/asterisk"

# Container läuft? -> Zeile mit Status "Up" und Ports 8088, 10000-10100
docker ps

# Asterisk antwortet? -> "Asterisk 20.x ..."
docker compose -f docker-compose.local.yml exec asterisk asterisk -rx "core show version"

# Nebenstellen angelegt? -> 1001 und 1002 (Status "Unavailable", solange kein Browser verbunden ist)
docker compose -f docker-compose.local.yml exec asterisk asterisk -rx "pjsip show endpoints"

# PJSIP-WebSocket-Transport geladen? -> res_pjsip_transport_websocket.so mit Status "Running"
docker compose -f docker-compose.local.yml exec asterisk asterisk -rx "module show like websocket"

# WebSocket-Endpunkt erreichbar? -> "HTTP/1.1 426 Upgrade Required" (richtig: normaler HTTP-Aufruf statt WebSocket), NICHT "Connection refused"
curl -i http://localhost:8088/ws
```

Die interaktive Asterisk-Konsole (Beenden mit `exit`, Asterisk läuft weiter):

```bash
docker compose -f docker-compose.local.yml exec asterisk asterisk -rvvv
```

---

## 3. CRM lokal konfigurieren

### 3.1 Login-E-Mail herausfinden

Im CRM unter **Einstellungen → „Profil & Account“** steht die E-Mail, mit der Sie sich einloggen. Genau diese E-Mail kommt in `SIP_ACCOUNTS`; Groß-/Kleinschreibung spielt keine Rolle.

### 3.2 `.env.local` ergänzen

Öffnen Sie `crm-lead-management/.env.local` und fügen Sie **am Ende** hinzu. Ersetzen Sie dabei `IHRE-LOGIN-EMAIL` und `TEST-EMAIL-ZWEITER-BENUTZER`; den zweiten Benutzer legen Sie in Test 4 an:

```bash
# --- Browser-Telefonie: LOKALER TEST ---
SIP_ENABLED=true
SIP_WSS_URL=ws://localhost:8088/ws
SIP_DOMAIN=localhost
SIP_REALM=asterisk
SIP_ACCOUNTS='{"IHRE-LOGIN-EMAIL":{"extension":"1001","password":"bitte-aendern-1001"},"TEST-EMAIL-ZWEITER-BENUTZER":{"extension":"1002","password":"bitte-aendern-1002"}}'
SIP_DEFAULT_COUNTRY_CODE=49
SIP_STUN_URLS=
```

Zu den einzelnen Werten:

- **`SIP_ENABLED=true` ist Pflicht.** Ohne diesen Wert meldet `/api/sip/config` „nicht konfiguriert“. Das Widget erscheint dann gar nicht, und Telefonnummern bleiben normale `tel:`-Links.
- **`SIP_ACCOUNTS` in einfachen Anführungszeichen** (`'…'`). So liest Next.js das JSON unverändert, auch wenn ein Passwort Sonderzeichen wie `$` enthält. Die Passwörter müssen exakt denen in `asterisk.env` entsprechen.
- **`SIP_STUN_URLS` leer:** Lokal braucht es keinen STUN-Server, und ohne ihn baut sich der Anruf schneller auf.
- **Warum `ws://` statt `wss://`?**
  - Browser verlangen `wss://` (verschlüsselt) nur auf **HTTPS-Seiten**. `http://localhost` gilt als sichere Ausnahme: Mikrofon und `ws://` sind dort erlaubt, und es gibt keinen Mixed-Content-Fehler.
  - Für `wss://` auf localhost bräuchten Sie ein Zertifikat, dem der Browser vertraut. Ein selbstsigniertes Zertifikat lehnen Browser bei WebSockets *stillschweigend* ab.
  - Das Audio ist trotzdem verschlüsselt (DTLS-SRTP); unverschlüsselt ist lokal nur die Signalisierung.
  - **Produktiv ist `wss://` Pflicht**, weil das CRM dort über HTTPS läuft.

### 3.3 CRM neu starten

`.env.local` wird nur beim Start gelesen:

```bash
# im CRM-Terminal: laufenden dev-Server mit Ctrl+C beenden, dann
cd "/Users/oguzhanyavuz/Hüseyin-Tas/crm-lead-management"
npm run dev
```

### 3.4 Konfiguration prüfen

Eingeloggt im Browser öffnen: **http://localhost:3000/api/sip/config**

| Antwort | Bedeutung |
|---|---|
| `{"enabled":true,"config":{…"uri":"sip:1001@localhost"…,"ha1":"…"}}` | ✅ richtig. Kein `password`-Feld, nur der `ha1`-Hash |
| `{"enabled":false,"reason":"not_configured"}` | `SIP_ENABLED`, `SIP_WSS_URL`, `SIP_DOMAIN` oder `SIP_ACCOUNTS` fehlt, oder der dev-Server wurde nicht neu gestartet |
| `{"enabled":false,"reason":"no_account"}` | Ihre Login-E-Mail steht nicht (bzw. falsch geschrieben) in `SIP_ACCOUNTS`, oder das JSON ist ungültig (Terminal zeigt „SIP_ACCOUNTS ist kein gültiges JSON“) |
| `{"message":"Nicht angemeldet."}` | erst im CRM einloggen |

---

## 4. Test-Szenarien

**Vorbereitung** (einmalig, im CRM unter **Kontakte → + Neuer Kontakt**):

| Vorname | Nachname | E-Mail (Pflichtfeld) | Telefonnummer |
|---|---|---|---|
| TEST | Echo | test-echo@example.com | `600` |
| TEST | Ansage | test-ansage@example.com | `601` |
| TEST | Kollege | test-kollege@example.com | `1002` |

---

### Test 1: Registrierung

1. http://localhost:3000/dashboard/kontakte öffnen (bzw. neu laden).
2. Unten rechts auf das Status-Widget achten.

**Erwartet:**

- „Telefon verbindet…“ (gelb, blinkend) wechselt nach 1–2 Sekunden zu **„Telefon bereit“ (grüner Punkt)**.
- In der Telefonnummern-Spalte erscheint vor jeder Nummer ein **grünes Hörer-Symbol**.
- Im Asterisk-Terminal: `Added contact 'sip:…@….invalid;transport=ws' to AOR '1001'`.
- Gegenprobe: `docker compose -f docker-compose.local.yml exec asterisk asterisk -rx "pjsip show contacts"` zeigt einen Eintrag für `1001` mit Status `Avail`.

**Prüft:** WebSocket-Verbindung, Zugangsdaten, HA1/Realm, die Konfigurations-Route im CRM.

---

### Test 2: Echo-Test (600)

1. In der Kontakttabelle bei **TEST Echo** auf die Nummer `600` klicken.
2. Beim ersten Mal fragt Chrome nach dem Mikrofon: **„Zulassen“**.
3. Das Anruf-Fenster zeigt „Wählt…“ und dann „Verbunden · 00:01“.
4. Sie hören eine englische Ansage („… echo test …“). Danach **hören Sie sich selbst** mit ca. einer halben Sekunde Verzögerung.
5. **Auflegen** klicken. Das Fenster zeigt kurz „Gespräch beendet“ und verschwindet nach 4 Sekunden.

**Prüft:** die komplette Audio-Strecke in beide Richtungen, also Mikrofon, ICE, DTLS-SRTP-Verschlüsselung, RTP-Ports, Codec und Lautsprecher. **Das ist der wichtigste Test:** Wenn er klappt, funktioniert die Technik. Danach fehlt nur noch der Trunk.

---

### Test 3: Ansage (601)

1. Bei **TEST Ansage** auf `601` klicken.
2. Sie hören „Hello world“, danach legt Asterisk automatisch auf.

**Prüft:** nur die Richtung Server → Browser. Das hilft bei der Fehlersuche: Test 3 klappt, Test 2 aber nicht? Dann liegt es am **Mikrofon bzw. an der Richtung Browser → Server**.

---

### Test 4: Interner Anruf 1001 ↔ 1002 (Klingelton, Annehmen, Ablehnen)

Dafür brauchen Sie einen zweiten CRM-Benutzer und ein zweites Browserfenster mit eigener Sitzung.

**Vorbereitung:**

1. Als Admin unter **Einstellungen → Benutzerverwaltung** einen Benutzer anlegen, z. B. `test-kollege@ihre-domain.de`.
2. Dieselbe E-Mail in `.env.local` bei `TEST-EMAIL-ZWEITER-BENUTZER` eintragen und `npm run dev` neu starten.
3. Ein **Chrome-Inkognito-Fenster** öffnen (`Cmd+Shift+N`), dort http://localhost:3000 aufrufen und **als Test-Kollege einloggen**.
4. Im Inkognito-Fenster **einmal irgendwo auf die Seite klicken**. Sonst darf Chrome dort keinen Klingelton abspielen (Autoplay-Policy).
5. Beide Fenster zeigen „Telefon bereit“. Setzen Sie Kopfhörer auf, denn beide Fenster nutzen dasselbe Mikrofon.

**4a – Annehmen:**

1. Normales Fenster (1001): bei **TEST Kollege** auf `1002` klicken.
2. Das Inkognito-Fenster (1002) zeigt **„Eingehend – Mitarbeiter Eins – Eingehender Anruf“**, und ein Klingelton ertönt.
3. Das normale Fenster zeigt „Klingelt…“.
4. Im Inkognito-Fenster auf **„Annehmen“** klicken. Beide Fenster zeigen „Verbunden“, und Sie hören sich über das jeweils andere Fenster.
5. In einem der Fenster **„Auflegen“** klicken. Beide Fenster zeigen „Gespräch beendet“.

**4b – Ablehnen:**

1. Erneut 1001 → 1002 anrufen und im Inkognito-Fenster **„Ablehnen“** klicken.
2. Das normale Fenster zeigt **„Besetzt“**.

**4c – Abbrechen, bevor abgenommen wird:**

1. 1001 → 1002 anrufen und im normalen Fenster **„Auflegen“** klicken, während es noch klingelt.
2. Das Inkognito-Fenster zeigt „Abgebrochen“, und der Klingelton stoppt.

**4d – Umgekehrte Richtung:**

1. Im Inkognito-Fenster einen Kontakt mit der Nummer `1001` anlegen („TEST Ich“).
2. Diesen Kontakt anrufen. Jetzt klingelt es im normalen Fenster.

**Prüft:** eingehende Anrufe, den Klingelton samt Autoplay-Verhalten, Annehmen/Ablehnen/Abbrechen und Audio zwischen zwei Browsern.

---

### Test 5: DTMF (Tastatur)

1. `600` anrufen (Echo-Test) und warten, bis Sie sich selbst hören.
2. Im Anruf-Fenster **„Tasten“** klicken. Ein Ziffernblock erscheint.
3. Einige Ziffern drücken (z. B. `1`, `2`, `3`). Sie hören dabei nichts; die Töne gehen als Signal (RFC 4733) an Asterisk, nicht als hörbarer Ton.
4. **`#` drücken.** Asterisk beendet den Echo-Test, und der Anruf endet („Gespräch beendet“).
5. Optional: In der Asterisk-Konsole (`asterisk -rvvv`, siehe 2.3) vorher `core set debug 1` eingeben. Dann erscheinen die empfangenen Ziffern als „DTMF … received“. Danach mit `core set debug 0` wieder ausschalten.

**Prüft:** die Tastatur-Übertragung. Später brauchen Sie sie für Sprachmenüs („Drücken Sie 1 für Vertrieb …“) bei angerufenen Firmen.

---

### Test 6: Fehlerfälle

**6a – Mikrofon blockiert**

1. In Chrome links in der Adressleiste auf das Symbol neben `localhost:3000` klicken (Schloss bzw. Regler), dann **Mikrofon → Blockieren**.
2. `600` anrufen.

**Erwartet:** Das Anruf-Fenster zeigt sofort **„Kein Mikrofon-Zugriff – bitte im Browser erlauben (Schloss-Symbol in der Adressleiste).“** Danach wieder auf „Zulassen“ stellen und die Seite neu laden.

**6b – Asterisk läuft nicht**

1. Im Asterisk-Terminal `Ctrl+C` drücken (oder `docker compose -f docker-compose.local.yml stop`).
2. Nach wenigen Sekunden zeigt das Widget **„Telefon verbindet…“** (gelb). Die Hörer-Symbole verschwinden, und ein Klick auf eine Nummer ist wieder ein normaler `tel:`-Link. Auf dem Mac öffnet das FaceTime; dort einfach auf „Abbrechen“ klicken.
3. Asterisk wieder starten: `docker compose -f docker-compose.local.yml up`. JsSIP verbindet sich **automatisch** neu, und nach bis zu ca. 30 Sekunden erscheint wieder „Telefon bereit“. Neu laden müssen Sie nicht.

**6c – Falsches Passwort**

1. In `.env.local` das Passwort von 1001 ändern (z. B. `falsch`) und `npm run dev` neu starten.
2. Das Widget zeigt **„Telefon nicht verfügbar“** (rot). Mit der Maus darüberfahren: „Anmeldung an der Telefonanlage abgelehnt – Zugangsdaten der Nebenstelle prüfen.“
3. Das Passwort danach zurücksetzen und neu starten.

**6d – Auflegen während der Anruf aufgebaut wird:** `600` anrufen und sofort auf „Auflegen“ klicken. Erwartet wird „Abgebrochen“, und es bleibt kein hängender Anruf übrig.

---

## 5. Debugging

### Im Browser

**`chrome://webrtc-internals`** in einem neuen Tab öffnen, *während* ein Anruf läuft:

- Oben erscheint ein Eintrag für `localhost:3000`. Aufklappen.
- **ICE connection state** sollte `checking` und dann `connected` zeigen. Bleibt es bei `checking` oder wechselt zu `failed`, liegt ein Netzwerkproblem vor (siehe Fehlertabelle: kein Ton).
- **Stats → `inbound-rtp` (audio):** `bytesReceived` muss laufend steigen. Das ist das Audio vom Server.
- **Stats → `outbound-rtp` (audio):** `bytesSent` muss steigen. Das ist Ihr Mikrofon.
- **ICE candidate pair:** zeigt, welche Adresse tatsächlich genutzt wird (z. B. `127.0.0.1:100xx`).

**JsSIP-Protokoll** (zeigt jede SIP-Nachricht): In der Browser-Konsole (`Cmd+Option+J`) eingeben:

```js
localStorage.debug = "JsSIP:*"
```

Danach die Seite neu laden. Zum Ausschalten:

```js
localStorage.removeItem("debug")
```

### In Asterisk

```bash
docker compose -f docker-compose.local.yml exec asterisk asterisk -rvvv
```

In der Konsole:

| Befehl | Zeigt |
|---|---|
| `pjsip show contacts` | welche Browser gerade registriert sind |
| `pjsip show endpoints` | alle Nebenstellen und ihren Zustand |
| `pjsip set logger on` | **jede** SIP-Nachricht live (REGISTER, INVITE, BYE …); ausschalten mit `pjsip set logger off` |
| `rtp set debug on` | ob Audio-Pakete ankommen (sehr viel Ausgabe!); ausschalten mit `rtp set debug off` |
| `core show channels` | laufende Gespräche |
| `dialplan show from-crm` | die Wahlregeln (600, 601, 1XXX …) |
| `core reload` | Konfiguration neu laden, ohne Neustart |

---

## 6. Fehlerbehebung

| Symptom | Wahrscheinliche Ursache | Lösung |
|---|---|---|
| **Kein Widget unten rechts** | `/api/sip/config` liefert `enabled:false` | Schritt 3.4 prüfen; dev-Server nach `.env.local`-Änderung neu gestartet? |
| **Widget bleibt bei „Telefon verbindet…“** | Asterisk läuft nicht, Port 8088 nicht erreichbar, oder `SIP_WSS_URL` falsch | `docker ps` (läuft der Container?), `curl -i http://localhost:8088/ws` (Antwort statt „refused“?), `SIP_WSS_URL=ws://localhost:8088/ws` exakt so, **nicht** `wss://`. Mit JsSIP-Logs (Kap. 5) sieht man den WebSocket-Fehler |
| **„Telefon nicht verfügbar“ / „Anmeldung abgelehnt“** | Passwort in `SIP_ACCOUNTS` ≠ `PBX_WEBRTC_USERS`, oder `SIP_REALM` ≠ `PBX_REALM` | beide Dateien vergleichen (Groß-/Kleinschreibung, Leerzeichen!). Nach einer Änderung an `asterisk.env` den Container neu erzeugen: `docker compose -f docker-compose.local.yml up --force-recreate`. Asterisk-Konsole zeigt `Failed to authenticate` |
| **Verbunden, aber kein Ton / Abbruch nach ~30 s** | Browser erreicht die RTP-Ports des Containers nicht (ICE `failed`) | **1.** Mit der LAN-IP statt 127.0.0.1 starten: `docker compose -f docker-compose.local.yml down` und dann `PBX_ICE_TARGET=$(ipconfig getifaddr en0) docker compose -f docker-compose.local.yml up` (WLAN = `en0`; bei LAN-Kabel ggf. `en1`, siehe `ifconfig`). **2.** VPN ausschalten. **3.** In `chrome://webrtc-internals` prüfen, ob ICE `connected` erreicht |
| **Einweg-Audio: ich höre die Ansage (601), aber das Echo (600) bleibt still** | Mikrofon liefert nichts: falsches Eingabegerät, stummgeschaltet, oder die Systemeinstellung blockiert Chrome | macOS: Systemeinstellungen → Datenschutz & Sicherheit → **Mikrofon → Google Chrome aktivieren**. Chrome: `chrome://settings/content/microphone` → richtiges Mikrofon wählen. In webrtc-internals steigt `outbound-rtp bytesSent`? |
| **Einweg-Audio: Echo still UND Ansage still, ICE aber `connected`** | Wiedergabe blockiert oder falsches Ausgabegerät | Erscheint im Anruf-Fenster „Ton ist blockiert – hier klicken“? Draufklicken. Sonst Ausgabegerät in macOS prüfen (Lautstärke, Kopfhörer) |
| `res_pjsip_transport_websocket declined to load` / Modul „Not Running“, Widget bleibt bei „verbindet…“ | Der veraltete `chan_sip` belegt das WebSocket-Subprotokoll „sip“ zuerst | ist in `entrypoint.sh` behoben (erzeugt `modules.conf` mit `noload => chan_sip.so`). Mit `docker compose -f docker-compose.local.yml up -d --build --force-recreate` neu bauen, dann `module show like websocket` prüfen |
| Build bricht ab: `Unable to locate package asterisk` | Paketquellen des Ubuntu-Images nicht erreichbar | Internetverbindung/VPN prüfen und erneut `docker compose -f docker-compose.local.yml build --no-cache` |
| `Bind for 0.0.0.0:8088 failed: port is already allocated` | Port 8088 ist belegt | `lsof -i :8088` zeigt den Prozess. Beenden, oder ein alter Container läuft noch: `docker compose -f docker-compose.local.yml down` |
| Eingehender Anruf ohne Klingelton | Autoplay-Policy: noch kein Klick im Fenster | einmal auf die Seite klicken. Der Anruf wird trotzdem angezeigt und lässt sich annehmen |
| Pfeifen/Rückkopplung | Lautsprecher und Mikrofon am selben Mac | Kopfhörer benutzen |
| Klick auf Nummer öffnet FaceTime | Telefonie (noch) nicht registriert → `tel:`-Fallback | erst „Telefon bereit“ abwarten |
| `reason: "no_account"` | E-Mail passt nicht, oder das JSON ist kaputt | JSON z. B. mit `node -e 'JSON.parse(process.argv[1])' '<Wert ohne äußere Hochkommas>'` prüfen |

**Wenn ein Test fehlschlägt**, prüfen Sie Schicht für Schicht, von unten nach oben:

1. **Läuft Asterisk?** Mit `docker ps` und `core show version` (Kapitel 2.3).
2. **Liefert das CRM die Konfiguration?** Über `/api/sip/config` (Kapitel 3.4).
3. **Ist der Browser registriert?** Widget grün und `pjsip show contacts`.
4. **Kommt der Anruf bei Asterisk an?** `pjsip set logger on` muss ein `INVITE` zeigen.
5. **Fließt Audio?** In `chrome://webrtc-internals`: ICE `connected`, und die Bytes steigen.

Die erste Schicht, die fehlschlägt, zeigt, wo Sie suchen müssen. Bei Rückfragen helfen die letzten ca. 50 Zeilen aus dem Asterisk-Terminal und der JsSIP-Konsole.

---

## 7. Checkliste

**Einrichtung**
- [ ] `brew update && brew install --cask docker-desktop`, Docker Desktop gestartet
- [ ] `docker run --rm hello-world` zeigt „Hello from Docker!“
- [ ] `cp asterisk.env.example asterisk.env`
- [ ] `docker compose -f docker-compose.local.yml up --build` zeigt `Asterisk Ready.`
- [ ] `pjsip show endpoints` listet 1001 und 1002
- [ ] `.env.local` ergänzt (`SIP_ENABLED=true`, Login-E-Mail in `SIP_ACCOUNTS`), `npm run dev` neu gestartet
- [ ] `/api/sip/config` liefert `enabled: true` mit `ha1` und ohne `password`

**Tests**
- [ ] Test 1: Widget „Telefon bereit“ (grün), Hörer-Symbole an den Nummern
- [ ] Test 2: Echo `600`, ich höre mich selbst
- [ ] Test 3: Ansage `601` hörbar
- [ ] Test 4a: 1001 → 1002, Klingelton, Annehmen, beide hören sich
- [ ] Test 4b: Ablehnen, Anrufer sieht „Besetzt“
- [ ] Test 4c: Abbrechen während es klingelt
- [ ] Test 4d: 1002 → 1001 (umgekehrte Richtung)
- [ ] Test 5: `#` beendet den Echo-Test
- [ ] Test 6a: Mikrofon blockiert, verständliche Meldung
- [ ] Test 6b: Asterisk gestoppt → „verbindet…“, nach Neustart automatisch wieder „bereit“
- [ ] Test 6c: falsches Passwort, rote Meldung

**Aufräumen**
- [ ] Testkontakte „TEST …“ löschen (Kontakte → auswählen → Löschen)
- [ ] Test-Benutzer in Einstellungen → Benutzerverwaltung löschen
- [ ] Asterisk stoppen: `docker compose -f docker-compose.local.yml down`
- [ ] In `.env.local` `SIP_ENABLED=false` setzen, solange Asterisk lokal nicht läuft. Sonst zeigt das Widget dauerhaft „verbindet…“

---

## 8. Nächste Schritte

**Wenn alle Tests grün sind:** Die komplette Technik (Browser, JsSIP, WebSocket, Asterisk, verschlüsseltes Audio) funktioniert. Für echte Anrufe fehlen nur noch der Server im Internet und der SIP-Trunk.

**Umstieg auf einen produktiven VPS** (Details in `README.md`, Kapitel 6):

1. **VPS mieten** (Ubuntu 24.04, öffentliche IPv4) und Docker installieren. Auf Linux kein Docker Desktop, sondern `curl -fsSL https://get.docker.com | sh`.
2. **Subdomain** anlegen, z. B. `pbx.ihre-domain.de`, als A-Record auf die Server-IP.
3. **Firewall** öffnen: 443/TCP, 80/TCP, 10000–20000/UDP. Port 5060/UDP später nur für den Anbieter.
4. **nginx und Let's-Encrypt-Zertifikat** mit `deploy/asterisk/nginx-pbx.conf` (enthält die Befehle).
5. **Asterisk starten:** Projektordner `deploy/asterisk/` auf den Server kopieren und `asterisk.env` anlegen.
   - In `asterisk.env` **neue, zufällige Passwörter** vergeben (`openssl rand -hex 16`).
   - **Eine Nebenstelle je Mitarbeiter.**
   - Dann auf dem Server: `docker compose up -d --build`, also die Produktiv-Datei, **nicht** `.local`.
6. **Vercel → Environment Variables:**
   - `SIP_ENABLED=true`
   - `SIP_WSS_URL=wss://pbx.ihre-domain.de/ws` (jetzt `wss`!)
   - `SIP_DOMAIN=pbx.ihre-domain.de`
   - `SIP_REALM=asterisk`
   - `SIP_ACCOUNTS` mit den neuen Passwörtern
   - `SIP_STUN_URLS=stun:stun.l.google.com:19302`
   - danach neu deployen.
7. Die Tests 1–5 auf https://crm.oguzhan-yavuz.com wiederholen. Sie funktionieren dort genauso, weil die Kontakte 600/601 und die Durchwahlen 1XXX auch ohne Trunk gehen.

**Nach dem Kauf der SIP-Leitung** in `asterisk.env` auf dem Server eintragen (die Werte stehen im Kundenportal des Anbieters):

| Variable | Wert vom Anbieter |
|---|---|
| `PBX_TRUNK_HOST` | Registrar / SIP-Server / Domain |
| `PBX_TRUNK_USER` | SIP-ID / Benutzername |
| `PBX_TRUNK_PASSWORD` | SIP-Passwort |
| `PBX_TRUNK_AUTH_USER` | nur falls der Anbieter einen separaten Auth-Benutzer nennt |
| `PBX_TRUNK_CALLERID` | Ihre Rufnummer für die Anzeige beim Angerufenen |
| `PBX_TRUNK_DIAL_PREFIX` | `00` (Standard) oder `+`, je nach Anbieter |

Danach:

```bash
docker compose up -d --force-recreate
docker compose exec asterisk asterisk -rx "pjsip show registrations"
```

Die zweite Zeile muss `Registered` zeigen. Anschließend die Checkliste in `README.md`, Kapitel 7 abarbeiten: eigenes Handy anrufen, Rufnummernanzeige, Gespräch > 60 s, eingehender Anruf, Sperrliste, Kostenlimit beim Anbieter. Im CRM ändert sich dabei nichts.
