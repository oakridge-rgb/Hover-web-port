import re
s = open('/home/z/my-project/scripts/out/stormos/cinema.html', encoding='utf-8', errors='replace').read()
out = []
pat = re.compile(r'function\s+(\w*[Ii]frame\w*)\s*\(([^)]*)\)\s*\{')
for m in pat.finditer(s):
    name, args = m.group(1), m.group(2)
    body = s[m.end():m.end() + 900]
    urls = re.findall(r'https://[^`"\']+', body)
    out.append(f'{name}({args})')
    for u in urls[:3]:
        out.append('    ' + u[:130])
open('/home/z/my-project/scripts/out/stormos/all_iframes.txt', 'w').write('\n'.join(out))
print('\n'.join(out))
