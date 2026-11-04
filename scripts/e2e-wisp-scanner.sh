#!/bin/bash
# e2e-wisp-scanner.sh — browser E2E for the wisp scanner test file
set -u
AB="agent-browser"
SITE=/home/z/my-project/download/site
LOG() { echo "==== $* ===="; }

cd "$SITE"
pkill -f 'http.server 8908' 2>/dev/null; sleep 0.5
python3 -m http.server 8908 --bind 127.0.0.1 >/tmp/e2e-http.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
curl -s -o /dev/null -w "server up: %{http_code}\n" http://localhost:8908/wisp-scanner.html

$AB --session wsc close >/dev/null 2>&1
$AB --session wsc open http://localhost:8908/wisp-scanner.html >/dev/null 2>&1
sleep 2
LOG "title"
$AB --session wsc get title | tail -1
LOG "boot state"
$AB --session wsc eval "({total:+document.getElementById('s-total').textContent, rows:document.querySelectorAll('#rows tr').length, listLen:document.getElementById('ep-list').value.split('\n').filter(Boolean).length})" | tail -1

# start scan with 4s timeout, concurrency 12
LOG "start scan"
$AB --session wsc eval "document.getElementById('timeout').value=4; document.getElementById('concurrency').value=12; document.getElementById('btn-start').click(); 'scan started'" | tail -1

# poll until done (max ~150s)
for i in $(seq 1 50); do
  sleep 4
  S=$($AB --session wsc eval "({pending:+document.getElementById('s-pending').textContent, alive:+document.getElementById('s-alive').textContent, blocked:+document.getElementById('s-blocked').textContent, to:+document.getElementById('s-timeout').textContent, btn:document.getElementById('btn-start').disabled})" 2>/dev/null | tail -1)
  echo "poll $i: $S"
  echo "$S" | grep -q "pending.: 0" && break
done

LOG "final state"
$AB --session wsc eval "({alive:+document.getElementById('s-alive').textContent, blocked:+document.getElementById('s-blocked').textContent, to:+document.getElementById('s-timeout').textContent})" | tail -1
LOG "alive endpoints (from cache)"
$AB --session wsc eval "Object.entries(JSON.parse(localStorage.getItem('fate_wisp_results')||'{}')).filter(([k,v])=>v.status==='alive').map(([k,v])=>k+(v.wisp?' [wisp-ok]':' [open-only]')).join('\n')" | tail -20
LOG "first rows of table"
$AB --session wsc eval "[...document.querySelectorAll('#rows tr')].slice(0,4).map(r=>r.textContent.trim().replace(/\s+/g,' ').slice(0,110)).join(' || ')" | tail -2
LOG "screenshot"
$AB --session wsc screenshot /tmp/wisp-scan-1.png >/dev/null 2>&1 && echo saved
$AB --session wsc close >/dev/null 2>&1
