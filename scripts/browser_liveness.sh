#!/bin/bash
# Browser-level liveness test for key player sources (JS runs, real verdict)
# For each: open, wait, eval = does any player/video/nested iframe exist?
set -u
URLS=(
  "vidsrc.pm|https://vidsrc.pm/embed/movie/550"
  "vidphantom|https://vidphantom.com/movie/550"
  "cinesrc.st|https://www.cinesrc.st/embed/movie/550"
  "videasy|https://player.videasy.to/movie/550"
  "2embed.cc|https://www.2embed.cc/embed/movie/550"
  "vidlink|https://vidlink.pro/movie/tt0137523"
  "yapgrid|https://yapgrid.com/embed/movie/550"
  "embedflix|https://embedflix.net/movie/550"
)
for entry in "${URLS[@]}"; do
  name="${entry%%|*}"; url="${entry#*|}"
  echo "=== $name ==="
  agent-browser open "$url" >/dev/null 2>&1
  agent-browser wait 6000 >/dev/null 2>&1
  agent-browser eval "(()=>{const v=document.querySelectorAll('video').length; const ifr=[...document.querySelectorAll('iframe')].map(f=>f.src.slice(0,60)).filter(Boolean); const pl=document.querySelectorAll('[class*=player],[id*=player],.jwplayer,.plyr,.video-js').length; const t=document.title.slice(0,50); return 'videos:'+v+' player-divs:'+pl+' iframes:'+ifr.length+(ifr.length?' ['+ifr[0]+']':'')+' | title:'+t;})()" 2>&1 | tail -1
done
echo "=== done ==="
