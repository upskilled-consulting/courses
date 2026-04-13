"""Minimal SPA dev server: mirrors the GH Pages 404→?r= redirect flow.

For any path without a file extension that doesn't map to a real file,
redirects to /?r=<path> so that index.html loads from the root and
relative asset paths (assets/js/platform.js etc.) resolve correctly.
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os, sys
from urllib.parse import quote

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        clean = self.path.split('?')[0].split('#')[0]
        # Root, real files, and paths with extensions are served normally
        if clean == '/' or os.path.exists(clean.lstrip('/')) or '.' in os.path.basename(clean):
            super().do_GET()
        else:
            # Mirror GH Pages: redirect to /?r=<path> so assets resolve from root
            redirect_to = '/?r=' + quote(clean)
            self.send_response(302)
            self.send_header('Location', redirect_to)
            self.end_headers()

    def log_message(self, *args):
        pass  # suppress per-request noise

HTTPServer(('', PORT), SPAHandler).serve_forever()
