#!/usr/bin/env python3
"""Examine TMDB fetch fallback chain + settings key override in cinema.html."""
s = open('/home/z/my-project/scripts/out/stormos/cinema.html', encoding='utf-8', errors='replace').read()

# Find the tmdbFetch / tmdbJson function region around TMDB_BASE
i = s.find("const TMDB_BASE")
print('=== TMDB FETCH REGION ===')
print(s[i:i+4200])
