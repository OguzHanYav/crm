#!/bin/sh
# Erzeugt die Asterisk-Konfiguration aus templates/ + Umgebungsvariablen (asterisk.env)
# und startet Asterisk im Vordergrund. Nach dem Kauf der SIP-Leitung müssen nur
# die PBX_TRUNK_*-Variablen in asterisk.env ergänzt werden.
set -eu

CONF=/etc/asterisk
: "${PBX_REALM:=asterisk}"
: "${PBX_WEBRTC_USERS:?PBX_WEBRTC_USERS fehlt (Format: 1001:passwort:Name;1002:passwort:Name)}"
: "${PBX_TRUNK_DIAL_PREFIX:=00}"
: "${PBX_TRUNK_CALLERID:=}"
: "${PBX_RTP_START:=10000}"
: "${PBX_RTP_END:=20000}"

# --- Nebenstellen der Mitarbeiter (WebRTC) ----------------------------------
: > "$CONF/pjsip_users.conf"
RINGGROUP=""
OLD_IFS=$IFS; IFS=';'
for entry in $PBX_WEBRTC_USERS; do
  ext=$(echo "$entry" | cut -d: -f1)
  pass=$(echo "$entry" | cut -d: -f2)
  name=$(echo "$entry" | cut -d: -f3-)
  [ -z "$ext" ] && continue
  cat >> "$CONF/pjsip_users.conf" <<USER

[$ext](webrtc-endpoint)
auth=$ext
aors=$ext
callerid="${name:-$ext}" <$ext>

[$ext](webrtc-auth)
username=$ext
password=$pass

[$ext](webrtc-aor)
USER
  RINGGROUP="${RINGGROUP:+$RINGGROUP&}PJSIP/$ext"
done
IFS=$OLD_IFS
export PBX_RINGGROUP="$RINGGROUP"

# --- NAT (Server mit privater IP, z. B. hinter Cloud-Firewall/Docker) --------
PBX_NAT_SETTINGS=""
if [ -n "${PBX_PUBLIC_IP:-}" ]; then
  PBX_NAT_SETTINGS="external_media_address=$PBX_PUBLIC_IP
external_signaling_address=$PBX_PUBLIC_IP
local_net=10.0.0.0/8
local_net=172.16.0.0/12
local_net=192.168.0.0/16"
fi
export PBX_NAT_SETTINGS

# --- SIP-Trunk: nur wenn Zugangsdaten eingetragen sind -----------------------
PBX_TRUNK_BLOCK="; (noch kein SIP-Trunk konfiguriert — PBX_TRUNK_* in asterisk.env setzen)"
if [ -n "${PBX_TRUNK_HOST:-}" ] && [ -n "${PBX_TRUNK_USER:-}" ] && [ -n "${PBX_TRUNK_PASSWORD:-}" ]; then
  : "${PBX_TRUNK_AUTH_USER:=$PBX_TRUNK_USER}"
  : "${PBX_TRUNK_REGISTRAR:=$PBX_TRUNK_HOST}"
  PBX_TRUNK_BLOCK="
[trunk-auth]
type=auth
auth_type=userpass
username=$PBX_TRUNK_AUTH_USER
password=$PBX_TRUNK_PASSWORD

[trunk-reg]
type=registration
transport=transport-udp
outbound_auth=trunk-auth
server_uri=sip:$PBX_TRUNK_REGISTRAR
client_uri=sip:$PBX_TRUNK_USER@$PBX_TRUNK_HOST
contact_user=$PBX_TRUNK_USER
retry_interval=60
forbidden_retry_interval=600
expiration=600
line=yes
endpoint=trunk

[trunk]
type=aor
contact=sip:$PBX_TRUNK_REGISTRAR
qualify_frequency=60

[trunk]
type=endpoint
transport=transport-udp
context=from-trunk
disallow=all
allow=alaw,ulaw
outbound_auth=trunk-auth
aors=trunk
from_user=$PBX_TRUNK_USER
from_domain=$PBX_TRUNK_HOST
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
send_pai=yes
dtmf_mode=rfc4733

[trunk-identify]
type=identify
endpoint=trunk
match=$PBX_TRUNK_REGISTRAR"
fi
export PBX_TRUNK_BLOCK

# Nur UNSERE Variablen ersetzen — ${EXTEN} & Co. im Dialplan bleiben erhalten.
VARS='$PBX_REALM $PBX_NAT_SETTINGS $PBX_TRUNK_BLOCK $PBX_TRUNK_CALLERID $PBX_TRUNK_DIAL_PREFIX $PBX_RINGGROUP'
export PBX_REALM PBX_TRUNK_CALLERID PBX_TRUNK_DIAL_PREFIX
envsubst "$VARS" < /templates/pjsip.conf.template > "$CONF/pjsip.conf"
envsubst "$VARS" < /templates/extensions.conf.template > "$CONF/extensions.conf"

# --- Module ------------------------------------------------------------------
# Das Ubuntu-Paket lädt per autoload auch den veralteten chan_sip. Der registriert
# beim Start das WebSocket-Subprotokoll "sip" — danach bekommt
# res_pjsip_transport_websocket es nicht mehr und lehnt das Laden ab ("declined to
# load"). Folge: Browser können sich nicht registrieren. Außerdem würde chan_sip
# mit PJSIP um UDP-Port 5060 konkurrieren. Daher chan_sip nie laden und die für
# WebRTC zwingenden Module als "require" markieren: Fehlt eines, bricht der Start
# mit klarer Fehlermeldung ab, statt still ohne WebSocket weiterzulaufen.
# (Ladereihenfolge regelt Asterisk selbst über die Modul-Abhängigkeiten —
# "preload" ist dafür nicht nötig.)
cat > "$CONF/modules.conf" <<'MODULES'
[modules]
autoload=yes

; Veraltet und im Konflikt mit PJSIP (WebSocket-Subprotokoll "sip", Port 5060)
noload => chan_sip.so

; Ohne diese Module keine Browser-Telefonie -> Start sonst abbrechen
require => res_http_websocket.so
require => res_pjsip.so
require => chan_pjsip.so
require => res_pjsip_transport_websocket.so

; Nicht benötigt, erzeugen nur Fehlermeldungen oder belegen Geräte/Ports
noload => chan_unistim.so
noload => chan_alsa.so
noload => chan_console.so
noload => chan_oss.so
noload => chan_mgcp.so
noload => chan_skinny.so
noload => chan_iax2.so
noload => pbx_dundi.so
noload => cdr_pgsql.so
noload => cdr_sqlite3_custom.so
noload => res_hep.so
noload => res_hep_pjsip.so
noload => res_hep_rtcp.so
noload => app_voicemail_imap.so
noload => app_voicemail_odbc.so
noload => res_config_odbc.so
noload => res_config_pgsql.so
noload => res_config_ldap.so
noload => cdr_radius.so
noload => cdr_tds.so
noload => cel_radius.so
noload => cel_tds.so
noload => cel_sqlite3_custom.so
; Standortdaten (RFC 6442) nicht benötigt; Beispielkonfig des Pakets ist ungültig
noload => res_pjsip_geolocation.so
noload => res_geolocation.so
MODULES

# --- RTP / ICE ---------------------------------------------------------------
{
  echo "[general]"
  echo "rtpstart=$PBX_RTP_START"
  echo "rtpend=$PBX_RTP_END"
  echo "icesupport=yes"
  [ -n "${PBX_STUN_ADDR:-}" ] && echo "stunaddr=$PBX_STUN_ADDR"
  # Nur für lokale Docker-Tests (Mac/Windows): interne Container-IP im ICE durch
  # eine vom Browser erreichbare Adresse ersetzen, z. B. "172.28.0.10 => 127.0.0.1".
  if [ -n "${PBX_ICE_HOST_MAPPING:-}" ]; then
    echo "[ice_host_candidates]"
    echo "$PBX_ICE_HOST_MAPPING"
  fi
} > "$CONF/rtp.conf"

# --- HTTP-Server für WebSocket (/ws) ------------------------------------------
{
  echo "[general]"
  echo "enabled=yes"
  # Unverschlüsselt NUR auf localhost bzw. hinter nginx (TLS dort). Im
  # Produktivbetrieb Port 8088 in der Firewall NICHT öffnen.
  echo "bindaddr=${PBX_HTTP_BIND:-127.0.0.1}"
  echo "bindport=8088"
  if [ -n "${PBX_TLS_CERT:-}" ] && [ -n "${PBX_TLS_KEY:-}" ]; then
    echo "tlsenable=yes"
    echo "tlsbindaddr=0.0.0.0:8089"
    echo "tlscertfile=$PBX_TLS_CERT"
    echo "tlsprivatekey=$PBX_TLS_KEY"
  fi
} > "$CONF/http.conf"

echo "Asterisk-Konfiguration erzeugt: $(grep -c 'webrtc-endpoint)' "$CONF/pjsip_users.conf") Nebenstelle(n), Trunk: ${PBX_TRUNK_HOST:-nicht konfiguriert}"
# Lokal (PBX_CONSOLE=true, braucht tty im Compose): Asterisk-Konsole im Vordergrund,
# damit Registrierungen und Anrufe live in `docker compose up` bzw. `docker compose logs` erscheinen.
if [ "${PBX_CONSOLE:-false}" = "true" ]; then
  exec asterisk -f -c -vvv
fi
exec asterisk -f -vvv
