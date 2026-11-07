#!/usr/bin/env python3
"""Extract the link template out of make-links.html into the standalone
download/fate-cdn/link.html with default values baked in."""
import pathlib
import re

BOT = pathlib.Path('/home/z/my-project/download/fate-cdn/make-links.html')
OUT = pathlib.Path('/home/z/my-project/download/fate-cdn/link.html')

html = BOT.read_text(encoding='utf-8')
m = re.search(r'<script type="text/plain" id="tpl">([\s\S]*?)</script>', html)
assert m, 'template not found'
tpl = m.group(1)
tpl = tpl.replace('</script~>', '</script>')
tpl = (tpl
       .replace('__REPO__', 'TongSherbet/storage')
       .replace('__FILE__', 'FATE.html')
       .replace('__BRANCH__', 'main')
       .replace('__KEYWORD__', 'os')
       .replace('__SRC__', ''))
assert '__' not in re.sub(r'data-fate-module', '', tpl), 'unresolved placeholder left'
OUT.write_text(tpl, encoding='utf-8')
print(f'wrote {OUT} ({len(tpl)/1024:.1f} KB)')
