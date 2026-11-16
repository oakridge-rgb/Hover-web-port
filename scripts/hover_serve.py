#!/usr/bin/env python3
"""Static server for the Hover web port (no-cache, wasm/data types, COOP/COEP)."""
import http.server, socketserver, os

os.chdir("/tmp/hover-out")

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        super().end_headers()
    def guess_type(self, path):
        if path.endswith(".wasm"): return "application/wasm"
        if path.endswith(".data"): return "application/octet-stream"
        if path.endswith(".js"): return "text/javascript"
        return super().guess_type(path)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", 8088), H) as httpd:
    httpd.serve_forever()
