#!/bin/bash
# e2e-v81.sh — one-shot E2E for FATE v8.1 jet portal (server + browser in same shell)
set -u
AB="agent-browser"
PASSA_DIR=/home/z/my-project/download
OUT=/home/z/my-project/scripts
LOG() { echo "==== $* ===="; }

cd "$PASSA_DIR"
pkill -f 'http.server 8902' 2>/dev/null; sleep 0.5
python3 -m http.server 8902 --bind 127.0.0.1 >/tmp/e2e-http.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
curl -s -o /dev/null -w "server up: %{http_code}\n" http://localhost:8902/fate-sw.js

################ PASS A: local assets present ################
LOG "PASS A: open + auth"
$AB --session v81a open http://localhost:8902/ >/dev/null 2>&1
sleep 1
$AB --session v81a eval "localStorage.setItem('fate_v6_auth','1prbs6n'); 'authed'" | tail -1
$AB --session v81a open http://localhost:8902/test-v8-jet-lane.html >/dev/null 2>&1
sleep 2
$AB --session v81a get title | tail -1

LOG "PASS A: boot jet via Apps modal"
$AB --session v81a eval "fateToggleApps(true); 'booting'" | tail -1
for i in $(seq 1 120); do
  ST=$($AB --session v81a eval "typeof FATE_JET_STATE !== 'undefined' ? FATE_JET_STATE : 'none'" 2>/dev/null | tail -1 | tr -d '"')
  [ "$ST" = "ready" ] && break
  [ "$ST" = "sw-failed" ] || [ "$ST" = "assets-failed" ] || [ "$ST" = "transport-failed" ] || [ "$ST" = "controller-failed" ] && break
  sleep 1
done
echo "FATE_JET_STATE=$ST after boot wait"
$AB --session v81a eval "JSON.stringify({sw: !!navigator.serviceWorker.controller, tr: !!window.FATE_TRANSPORT, lane: window.wlspServer || null, swept: (window.FATE_WISP_RESULTS||[]).filter(r=>r.rtt!==null).length})" | tail -1
$AB --session v81a eval "document.getElementById('fateJetStatus').innerText" | tail -3
$AB --session v81a eval "JSON.stringify(typeof FATE_ASSET_SRC !== 'undefined' ? FATE_ASSET_SRC : {})" | tail -1
$AB --session v81a screenshot $OUT/verify-v81-apps.png >/dev/null 2>&1 && echo "shot: apps"

if [ "${ST:-}" = "ready" ]; then
  LOG "PASS A: proxied example.com"
  $AB --session v81a eval "fateBrowseOpen('https://example.com/'); 'nav'" | tail -1
  for i in $(seq 1 30); do
    T=$($AB --session v81a eval "(()=>{try{return document.getElementById('fateBrowseFrame').contentDocument.title}catch(e){return 'ERR'}})()" 2>/dev/null | tail -1)
    echo "$T" | grep -q "Example" && break
    sleep 1
  done
  echo "frame title: $T"
  $AB --session v81a eval "(()=>{try{return document.getElementById('fateBrowseFrame').contentWindow.location.href}catch(e){return 'ERR'}})()" | tail -1
  $AB --session v81a screenshot $OUT/verify-v81-example.png >/dev/null 2>&1 && echo "shot: example"

  LOG "PASS A: proxied TikTok /foryou"
  $AB --session v81a eval "fateBrowseOpen('https://www.tiktok.com/foryou'); 'nav'" | tail -1
  TT=timeout
  for i in $(seq 1 50); do
    T=$($AB --session v81a eval "(()=>{try{return document.getElementById('fateBrowseFrame').contentDocument.title}catch(e){return 'ERR'}})()" 2>/dev/null | tail -1)
    echo "$T" | grep -qi "tiktok" && { TT=ok; break; }
    sleep 1
  done
  echo "tiktok title ($TT): $T"
  $AB --session v81a eval "(()=>{try{const d=document.getElementById('fateBrowseFrame').contentDocument;return 'dom='+d.body.innerHTML.length}catch(e){return 'ERR'}})()" | tail -1
  $AB --session v81a screenshot $OUT/verify-v81-tiktok.png >/dev/null 2>&1 && echo "shot: tiktok"

  LOG "PASS A: proxied YouTube"
  $AB --session v81a eval "fateBrowseOpen('https://www.youtube.com/'); 'nav'" | tail -1
  YT=timeout
  for i in $(seq 1 50); do
    R=$($AB --session v81a eval "(()=>{try{const d=document.getElementById('fateBrowseFrame').contentDocument;return (d.querySelector('#content')||d.querySelector('ytd-app'))?'yt-ui':'dom='+d.body.innerHTML.length}catch(e){return 'ERR'}})()" 2>/dev/null | tail -1)
    [ "$R" = "yt-ui" ] && { YT=ok; break; }
    sleep 1
  done
  echo "youtube ui ($YT): $R"
  $AB --session v81a screenshot $OUT/verify-v81-youtube.png >/dev/null 2>&1 && echo "shot: youtube"
fi

LOG "PASS A: console + errors snapshot"
$AB --session v81a console 2>/dev/null | tail -12
$AB --session v81a errors 2>/dev/null | tail -6

################ PASS B: local assets removed -> CDN mirror fallback ################
LOG "PASS B: hide local jet assets"
mkdir -p /tmp/jet-hidden
for f in jet.core.js jet.api.js jet.inject.js jet.utils.js jet.wasm; do
  mv "$PASSA_DIR/$f" /tmp/jet-hidden/ 2>/dev/null
done
curl -s -o /dev/null -w "jet.core.js now: %{http_code}\n" http://localhost:8902/jet.core.js

$AB --session v81b open http://localhost:8902/ >/dev/null 2>&1
sleep 1
$AB --session v81b eval "localStorage.setItem('fate_v6_auth','1prbs6n'); 'authed'" | tail -1
$AB --session v81b open http://localhost:8902/test-v8-jet-lane.html >/dev/null 2>&1
sleep 2
$AB --session v81b eval "fateToggleApps(true); 'booting'" | tail -1
for i in $(seq 1 120); do
  ST2=$($AB --session v81b eval "typeof FATE_JET_STATE !== 'undefined' ? FATE_JET_STATE : 'none'" 2>/dev/null | tail -1 | tr -d '"')
  [ "$ST2" = "ready" ] && break
  case "$ST2" in sw-failed|assets-failed|transport-failed|controller-failed) break;; esac
  sleep 1
done
echo "PASS B FATE_JET_STATE=$ST2"
$AB --session v81b eval "document.getElementById('fateJetStatus').innerText" | tail -3
$AB --session v81b eval "JSON.stringify(typeof FATE_ASSET_SRC !== 'undefined' ? FATE_ASSET_SRC : {})" | tail -1

if [ "${ST2:-}" = "ready" ]; then
  $AB --session v81b eval "fateBrowseOpen('https://example.com/'); 'nav'" | tail -1
  for i in $(seq 1 30); do
    T2=$($AB --session v81b eval "(()=>{try{return document.getElementById('fateBrowseFrame').contentDocument.title}catch(e){return 'ERR'}})()" 2>/dev/null | tail -1)
    echo "$T2" | grep -q "Example" && break
    sleep 1
  done
  echo "PASS B frame title: $T2"
  $AB --session v81b screenshot $OUT/verify-v81-mirror.png >/dev/null 2>&1 && echo "shot: mirror"
fi

################ cleanup + restore ################
LOG "restore assets"
for f in jet.core.js jet.api.js jet.inject.js jet.utils.js jet.wasm; do
  mv /tmp/jet-hidden/$f "$PASSA_DIR/" 2>/dev/null
done
ls "$PASSA_DIR" | rg "^jet" || true
$AB --session v81a close >/dev/null 2>&1
$AB --session v81b close >/dev/null 2>&1
LOG "E2E DONE"
