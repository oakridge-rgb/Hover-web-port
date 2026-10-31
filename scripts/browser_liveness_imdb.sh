#!/bin/bash
# Test IMDb-ID variants of the 4 alive providers (+ TV variant) in a real browser
set -u
URLS=(
  "vidsrc.pm IMDb movie|https://vidsrc.pm/embed/movie/tt0137523"
  "vidsrc.pm IMDb tv S1E1|https://vidsrc.pm/embed/tv/tt0903747/1/1"
  "cinesrc.st IMDb movie|https://www.cinesrc.st/embed/movie/tt0137523"
  "yapgrid IMDb movie|https://yapgrid.com/embed/movie/tt0137523"
  "2embed.cc IMDb movie|https://www.2embed.cc/embed/movie/tt0137523"
  "2embed.cc IMDb tv S1E1|https://www.2embed.cc/embed/tv/tt0903747/1/1"
)
for entry in "${URLS[@]}"; do
  name="${entry%%|*}"; url="${entry#*|}"
  echo "=== $name ==="
  agent-browser open "$url" >/dev/null 2>&1
  agent-browser wait 6000 >/dev/null 2>&1
  agent-browser eval "(()=>{const v=document.querySelectorAll('video').length; const pl=document.querySelectorAll('[class*=player],[id*=player],.jwplayer,.plyr,.video-js').length; return 'videos:'+v+' player-divs:'+pl+' | title:'+document.title.slice(0,55);})()" 2>&1 | tail -1
done
agent-browser close >/dev/null 2>&1
echo "=== done ==="
