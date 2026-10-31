#!/usr/bin/env python3
"""Full provider/source list + key form storage logic in cinema.html."""
s = open('/home/z/my-project/scripts/out/stormos/cinema.html', encoding='utf-8', errors='replace').read()

# 1. The SOURCES picker array
i = s.find('playerServers') if 'playerServers' in s else s.find('SOURCES')
for needle in ['const SOURCES', 'const PLAYER_SOURCES', 'playerServers', 'sourcePicker', 'buildSourceButtons']:
    j = s.find(needle)
    if j >= 0:
        print(f'=== {needle} @ {j} ===')
        print(s[j:j+1800])
        break

# 2. save-key handler
j = s.find("Save & load catalog")
if j >= 0:
    k = s.find("function", j + 100)
    seg = s[j:j+2600]
    print('=== KEY SAVE REGION ===')
    print(seg[:2600])
