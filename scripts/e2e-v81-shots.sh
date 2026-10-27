#!/bin/bash
# e2e-v81-shots.sh — clean browse-view screenshots + address bar decode check
set -u
AB="agent-browser"
cd /home/z/my-project/download
pkill -f 'http.server 8902' 2>/dev/null; sleep 0.5
python3 -m http.server 8902 --bind 127.0.0.1 >/tmp/e2e-http.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1

$AB --session v81c open http://localhost:8902/ >/dev/null 2>&1
sleep 1
$AB --session v81c eval "localStorage.setItem('fate_v6_auth','1prbs6n'); 'authed'" | tail -1
$AB --session v81c open http://localhost:8902/test-v8-jet-lane.html >/dev/null 2>&1
sleep 2
$AB --session v81c eval "fateToggleApps(true); 'booting'" | tail -1
for i in $(seq 1 120); do
  ST=$($AB --session v81c eval "typeof FATE_JET_STATE !== 'undefined' ? FATE_JET_STATE : 'none'" 2>/dev/null | tail -1 | tr -d '"')
  [ "$ST" = "ready" ] && break
  case "$ST" in sw-failed|assets-failed|transport-failed|controller-failed) break;; esac
  sleep 1
done
echo "state: $ST"
if [ "$ST" = "ready" ]; then
  # TikTok via the real tile click flow (modal closes, browse opens)
  $AB --session v81c eval "fateToggleApps(false); fateBrowseOpen('https://www.tiktok.com/foryou'); 'nav'" | tail -1
  for i in $(seq 1 50); do
    T=$($AB --session v81c eval "(()=>{try{return document.getElementById('fateBrowseFrame').contentDocument.title}catch(e){return 'ERR'}})()" 2>/dev/null | tail -1)
    echo "$T" | grep -qi tiktok && break
    sleep 1
  done
  echo "tiktok: $T"
  sleep 4
  $AB --session v81c screenshot /home/z/my-project/scripts/verify-v81-tiktok2.png >/dev/null 2>&1 && echo shot-tiktok2
  $AB --session v81c eval "document.getElementById('fateBrowseAddr').value" | tail -1

  $AB --session v81c eval "fateBrowseOpen('https://www.youtube.com/'); 'nav'" | tail -1
  for i in $(seq 1 60); do
    R=$($AB --session v81c eval "(()=>{try{const d=document.getElementById('fateBrowseFrame').contentDocument;return (d.querySelector('#content')||d.querySelector('ytd-app'))?'yt-ui':'no'}catch(e){return 'ERR'}})()" 2>/dev/null | tail -1)
    [ "$R" = "yt-ui" ] && break
    sleep 1
  done
  echo "youtube: $R"
  sleep 3
  $AB --session v81c screenshot /home/z/my-project/scripts/verify-v81-youtube2.png >/dev/null 2>&1 && echo shot-youtube2
  $AB --session v81c eval "document.getElementById('fateBrowseAddr').value" | tail -1
fi
$AB --session v81c close >/dev/null 2>&1
echo DONE
