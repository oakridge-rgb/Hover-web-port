#!/bin/bash
# Re-probe every Stratus mirror + backup wss endpoints, current state.
MIRRORS=(
  "cdn.northstreetumc.org"
  "cdn.vipersfutbol.com"
  "cdn.pcesc.org"
  "cdn.kcchallengevbc.com"
  "cdn.slcbmooc.org"
  "cdn.topstargym.net"
  "cdn.goaplytexas.org"
  "cdn.clearfieldswimming.com"
  "cdn.richardacademy.cfd"
)
echo "=== /stratus/status probes (10s max each, parallel) ==="
for h in "${MIRRORS[@]}"; do
  (
    out=$(curl -sS -m 10 -o /tmp/probe_$h.txt -w "%{http_code} %{time_total}s" "https://$h/stratus/status" \
      -H "accept: application/json" -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" 2>&1)
    body=$(head -c 120 /tmp/probe_$h.txt | tr '\n' ' ')
    echo "[$h] HTTP=$out | body: $body"
  ) &
done
wait
echo ""
echo "=== root + /wi/ edge checks on the two most interesting hosts ==="
for h in "cdn.northstreetumc.org" "cdn.vipersfutbol.com"; do
  code=$(curl -sS -m 8 -o /dev/null -w "%{http_code}" "https://$h/" 2>&1)
  wi=$(curl -sS -m 8 -o /dev/null -w "%{http_code}" "https://$h/wi/ping" 2>&1)
  echo "[$h] / -> $code | /wi/ping -> $wi"
done
