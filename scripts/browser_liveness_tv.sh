#!/bin/bash
# Verify TV routes of alive providers with TMDB id 1396 (Breaking Bad)
set -u
URLS=(
  "vidsrc.pm TV tmdb|https://vidsrc.pm/embed/tv/1396/1/1"
  "cinesrc TV tmdb|https://www.cinesrc.st/embed/tv/1396?s=1&e=1"
  "yapgrid TV tmdb|https://yapgrid.com/embed/tv/1396/1/1"
  "2embed TV tmdb|https://www.2embed.cc/embed/tv/1396/1/1"
  "vidlink TMDB movie|https://vidlink.pro/movie/550"
  "vidlink TV tmdb|https://vidlink.pro/tv/1396/1/1"
)
for entry in "${URLS[@]}"; do
  name="${entry%%|*}"; url="${entry#*|}"
  echo "=== $name ==="
  agent-browser open "$url" >/dev/null 2>&1
  agent-browser wait 6500 >/dev/null 2>&1
  agent-browser eval "(()=>{const v=document.querySelectorAll('video').length; const pl=document.querySelectorAll('[class*=player],[id*=player],.jwplayer,.plyr,.video-js').length; return 'videos:'+v+' player-divs:'+pl+' | '+document.title.slice(0,50);})()" 2>&1 | tail -1
done
agent-browser close >/dev/null 2>&1
echo "=== done ==="
