"""Minimal SPA dev server: serves index.html for any path without a file extension."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        clean = self.path.split('?')[0].split('#')[0]
        # If the path has a file extension or resolves to a real file, serve normally
        if os.path.exists(clean.lstrip('/')) or '.' in os.path.basename(clean):
            super().do_GET()
        else:
            self.path = '/index.html'
            super().do_GET()

    def log_message(self, *args):
        pass  # suppress per-request noise

HTTPServer(('', PORT), SPAHandler).serve_forever()
