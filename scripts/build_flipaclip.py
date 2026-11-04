#!/usr/bin/env python3
"""Assemble the single-file FlipaClip Studio HTML app."""
import pathlib

root = pathlib.Path('/home/z/my-project/scripts')
out = pathlib.Path('/home/z/my-project/download/flipaclip.html')

css = (root / 'fc-ui.css').read_text()
body = (root / 'fc-body.html').read_text()
js_parts = ['fc-gif.js', 'fc-zip.js', 'fc-core.js', 'fc-export.js']
js = '\n\n'.join((root / f).read_text() for f in js_parts)
out.parent.mkdir(parents=True, exist_ok=True)

html = (
    '<!doctype html>\n'
    '<html lang="en">\n'
    '<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">\n'
    '<title>FlipaClip Studio — Frame-by-Frame Animation</title>\n'
    '<style>\n' + css + '\n</style>\n'
    '</head>\n'
    '<body>\n'
    + body +
    '\n<script>\n' + js + '\n</script>\n'
    '</body>\n'
    '</html>\n'
)

out.write_text(html)
print('wrote', out, len(html), 'bytes')
