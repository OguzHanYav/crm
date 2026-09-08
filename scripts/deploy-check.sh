#!/usr/bin/env bash
# Post-Deployment-Check: wärmt die Ziel-URL(s) auf, misst die Ladezeit mit curl,
# vergleicht gegen den letzten Lauf und gibt PASS/FAIL aus.
#
# Nutzung:
#   ./scripts/deploy-check.sh [URL] [--path /some/path]... [--threshold-ms 1500]
#
# Beispiele:
#   ./scripts/deploy-check.sh
#   ./scripts/deploy-check.sh https://crm.oguzhan-yavuz.com
#   ./scripts/deploy-check.sh https://crm.oguzhan-yavuz.com --path /login --path /api/contacts
#
# Hinweis: /dashboard/* verlangt eine eingeloggte Session. Ohne Session-Cookie
# misst curl hier nur die Redirect-Antwort (Proxy -> /login), nicht die
# vollständige Seite. Für einen echten Seiten-Ladezeit-Test ein Cookie mitgeben:
#   COOKIE='sb-access-token=...' ./scripts/deploy-check.sh
#
# Baseline wird in .deploy-check-baseline.txt im Projekt-Root abgelegt
# (Format: "<path> <ms>" pro Zeile) — bitte zu .gitignore hinzufügen, falls
# noch nicht geschehen.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_FILE="$PROJECT_ROOT/.deploy-check-baseline.txt"

URL=""
PATHS=()
THRESHOLD_MS=1500
WARMUP_REQUESTS=2
MEASURE_REQUESTS=3

while [ $# -gt 0 ]; do
  case "$1" in
    --path)
      PATHS+=("$2")
      shift 2
      ;;
    --threshold-ms)
      THRESHOLD_MS="$2"
      shift 2
      ;;
    http*)
      URL="$1"
      shift
      ;;
    *)
      echo "Unbekanntes Argument: $1" >&2
      exit 1
      ;;
  esac
done

URL="${URL:-https://crm.oguzhan-yavuz.com}"
if [ "${#PATHS[@]}" -eq 0 ]; then
  PATHS=("/login" "/dashboard/kontakte" "/api/contacts")
fi

COOKIE_HEADER=()
if [ -n "${COOKIE:-}" ]; then
  COOKIE_HEADER=(-H "Cookie: $COOKIE")
fi

echo "=== Deploy Check: $URL ==="
echo "Pfade: ${PATHS[*]}"
echo "Schwelle: ${THRESHOLD_MS}ms"
echo ""

# --- 1. Warmup ---
echo "-> Wärme auf ($WARMUP_REQUESTS Requests je Pfad) ..."
for path in "${PATHS[@]}"; do
  for _ in $(seq 1 "$WARMUP_REQUESTS"); do
    curl -s -o /dev/null "${COOKIE_HEADER[@]+"${COOKIE_HEADER[@]}"}" "$URL$path" || true
  done
done
echo "   fertig."
echo ""

# --- 2. Messen ---
echo "-> Messe Ladezeit (curl, $MEASURE_REQUESTS Requests je Pfad) ..."

CURRENT_FILE="$(mktemp)"
trap 'rm -f "$CURRENT_FILE"' EXIT

for path in "${PATHS[@]}"; do
  total_s="0"
  status_code=""
  for _ in $(seq 1 "$MEASURE_REQUESTS"); do
    result=$(curl -s -o /dev/null "${COOKIE_HEADER[@]+"${COOKIE_HEADER[@]}"}" \
      -w "%{time_total} %{http_code}" "$URL$path")
    t="${result%% *}"
    status_code="${result##* }"
    total_s=$(awk -v a="$total_s" -v b="$t" 'BEGIN { printf "%.6f", a + b }')
  done
  avg_ms=$(awk -v total="$total_s" -v n="$MEASURE_REQUESTS" 'BEGIN { printf "%.0f", (total / n) * 1000 }')
  echo "$path $avg_ms" >> "$CURRENT_FILE"
  printf "   %-25s Ø %5sms   (letzter Status: %s)\n" "$path" "$avg_ms" "$status_code"
done
echo ""

# --- 3. Vergleich vorher/nachher ---
echo "-> Vergleich mit letztem Lauf ..."
overall_pass=1

while read -r path avg_ms; do
  [ -z "$path" ] && continue
  prev_ms=""
  if [ -f "$BASELINE_FILE" ]; then
    prev_ms=$(awk -v p="$path" '$1 == p { print $2 }' "$BASELINE_FILE" | tail -1)
  fi

  status="PASS"
  reason=""
  if [ "$avg_ms" -gt "$THRESHOLD_MS" ]; then
    status="FAIL"
    reason=" (über Schwelle von ${THRESHOLD_MS}ms)"
    overall_pass=0
  fi

  if [ -n "$prev_ms" ]; then
    diff_ms=$((avg_ms - prev_ms))
    if [ "$diff_ms" -gt 0 ]; then
      trend="+${diff_ms}ms langsamer als zuvor (${prev_ms}ms)"
    elif [ "$diff_ms" -lt 0 ]; then
      trend="${diff_ms}ms schneller als zuvor (${prev_ms}ms)"
    else
      trend="unverändert (${prev_ms}ms)"
    fi
  else
    trend="kein vorheriger Lauf zum Vergleich"
  fi

  printf "   [%s] %-25s %5sms — %s%s\n" "$status" "$path" "$avg_ms" "$trend" "$reason"
done < "$CURRENT_FILE"

# --- 4. Baseline aktualisieren ---
mv "$CURRENT_FILE" "$BASELINE_FILE"
trap - EXIT

echo ""
if [ "$overall_pass" -eq 1 ]; then
  echo "=== GESAMT: PASS ==="
  exit 0
else
  echo "=== GESAMT: FAIL ==="
  exit 1
fi
