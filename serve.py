#!/usr/bin/env python3
"""Aiko's local development server.

Run it from the project folder:

    python3 serve.py

then open http://localhost:8000

Why this file exists
--------------------
The usual `python3 -m http.server` lets your browser hold on to old, cached
copies of the CSS and JavaScript. After you edit a file, a normal refresh can
keep showing the *previous* version, which makes a change look like it "didn't
work" when it actually did.

This server adds one instruction to every response: "do not cache this". With
that in place, a normal refresh (Cmd+R / Ctrl+R) always shows your latest edits.

Use this while building. For a deployed site you don't need it, real hosts
handle caching themselves.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serves the folder exactly like http.server, but forbids caching."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    print(f"Aiko dev server running, open http://localhost:{PORT}")
    print("Caching is disabled, so every edit shows on a normal refresh.")
    print("Press Ctrl+C to stop.")
    try:
        ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
