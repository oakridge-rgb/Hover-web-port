#!/bin/bash
# Bisect which headers unlock /stratus/status, and inspect CORS on responses.
URL="https://cdn.vipersfutbol.com/stratus/status"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

t() {
  local label="$1"; shift
  local out code time
  out=$(curl -sS -m 8 -o /tmp/bisect_body.txt -w "%{http_code} %{time_total}" "$URL" "$@" 2>&1 | tail -1)
  code="${out%% *}"; time="${out##* }"
  local body; body=$(head -c 60 /tmp/bisect_body.txt 2>/dev/null | tr -d '\n')
  printf "%-42s HTTP=%s t=%ss | %s\n" "$label" "$code" "$time" "$body"
}

t "bare (no headers)"
t "ua only"                          -H "user-agent: $UA"
t "ua + sec-fetch-mode: cors"        -H "user-agent: $UA" -H "sec-fetch-mode: cors"
t "ua + sec-fetch-dest: empty"       -H "user-agent: $UA" -H "sec-fetch-dest: empty"
t "ua + sec-fetch-site: cross-site"  -H "user-agent: $UA" -H "sec-fetch-site: cross-site"
t "ua + sec-ch-ua"                   -H "user-agent: $UA" -H 'sec-ch-ua: "Chromium";v="126"'
t "ua + origin"                      -H "user-agent: $UA" -H "origin: https://example.com"
t "ua + accept-language"             -H "user-agent: $UA" -H "accept-language: en-US,en;q=0.9"
t "ua + accept json"                 -H "user-agent: $UA" -H "accept: application/json"
t "ALL sec-* (no origin)"            -H "user-agent: $UA" -H "sec-fetch-dest: empty" -H "sec-fetch-mode: cors" -H "sec-fetch-site: cross-site" -H 'sec-ch-ua: "Chromium";v="126"' -H "accept: application/json"

echo ""
echo "=== response headers with origin=example.com ==="
curl -sS -m 8 -D - -o /dev/null "$URL" \
  -H "user-agent: $UA" -H "sec-fetch-dest: empty" -H "sec-fetch-mode: cors" \
  -H "sec-fetch-site: cross-site" -H 'sec-ch-ua: "Chromium";v="126"' \
  -H "origin: https://example.com" -H "accept: application/json" 2>&1 | head -25

echo ""
echo "=== response headers with NO origin (same-origin style) ==="
curl -sS -m 8 -D - -o /dev/null "$URL" \
  -H "user-agent: $UA" -H "sec-fetch-dest: empty" -H "sec-fetch-mode: cors" \
  -H "sec-fetch-site: same-origin" -H 'sec-ch-ua: "Chromium";v="126"' \
  -H "accept: application/json" 2>&1 | head -25
