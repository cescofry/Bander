#!/usr/bin/env python3
"""Bander local server.

Serves the generic frontend app and exposes a small API for band discovery.
All bands live under the ``bands/`` directory as self-contained packages.

Usage:
    python3 server.py [--port 8888] [--bands-dir ./bands]

Endpoints:
    GET  /                       -> app/index.html (the SPA shell)
    GET  /app/<path>             -> static files under app/
    GET  /api/bands              -> JSON list of available band summaries
    GET  /api/bands/<slug>       -> merged payload for one band
    GET  /bands/<slug>/<path>    -> static assets inside a band package
"""

import argparse
import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).parent.resolve()
DEFAULT_PORT = 8888


class BanderHandler(SimpleHTTPRequestHandler):
    """Route requests to the app shell, API, or band assets."""

    bands_dir: Path = ROOT / "bands"
    app_dir: Path = ROOT / "app"

    # -----------------------------------------------------------------
    # Routing
    # -----------------------------------------------------------------

    def do_GET(self):
        path = unquote(urlparse(self.path).path)

        # API: list all bands
        if path == "/api/bands":
            self._send_json(self._list_bands())
            return

        # API: single band payload
        if path.startswith("/api/bands/"):
            slug = path[len("/api/bands/"):].strip("/")
            data = self._load_band(slug)
            if data is None:
                self._send_error(404, {"error": f"Band '{slug}' not found"})
            else:
                self._send_json(data)
            return

        # Band static assets
        if path.startswith("/bands/"):
            self._serve_file(self.bands_dir.parent / path.lstrip("/"))
            return

        # App static assets
        if path.startswith("/app/"):
            self._serve_file(self.app_dir.parent / path.lstrip("/"))
            return

        # Root -> serve app/index.html (SPA entry)
        if path == "/" or path == "/index.html":
            self._serve_file(self.app_dir / "index.html")
            return

        # Fallback: try under app/ (for direct asset references)
        candidate = self.app_dir / path.lstrip("/")
        if candidate.exists() and candidate.is_file():
            self._serve_file(candidate)
            return

        self._send_error(404, {"error": "Not found"})

    # -----------------------------------------------------------------
    # Band discovery
    # -----------------------------------------------------------------

    def _list_bands(self):
        bands = []
        if not self.bands_dir.is_dir():
            return bands
        for entry in sorted(self.bands_dir.iterdir()):
            band_json = entry / "band.json"
            if entry.is_dir() and band_json.exists():
                try:
                    info = json.loads(band_json.read_text(encoding="utf-8"))
                    bands.append({
                        "slug": entry.name,
                        "name": info.get("name", entry.name),
                        "genres": info.get("genres", []),
                        "formed": info.get("formed", ""),
                        "origin": info.get("origin", ""),
                        "description": info.get("description", ""),
                    })
                except (json.JSONDecodeError, OSError):
                    pass
        return bands

    def _load_band(self, slug: str):
        band_dir = self.bands_dir / slug
        if not band_dir.is_dir():
            return None
        band_json = band_dir / "band.json"
        if not band_json.exists():
            return None

        try:
            data = json.loads(band_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

        # Merge optional split files
        for key, filename in [
            ("members", "members.json"),
            ("events", "events.json"),
            ("videos", "videos.json"),
            ("albums", "albums.json"),
        ]:
            split_file = band_dir / filename
            if split_file.exists():
                try:
                    data[key] = json.loads(split_file.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    pass

        # Load theme if present
        theme_file = band_dir / "theme.json"
        if theme_file.exists():
            try:
                data["theme"] = json.loads(theme_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass

        return data

    # -----------------------------------------------------------------
    # Response helpers
    # -----------------------------------------------------------------

    def _send_json(self, obj):
        body = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, filepath: Path):
        filepath = filepath.resolve()
        if not filepath.exists() or not filepath.is_file():
            self._send_error(404, {"error": "Not found"})
            return

        # Basic MIME detection
        ext = filepath.suffix.lower()
        mime_map = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".webp": "image/webp",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
            ".ttf": "font/ttf",
        }
        content_type = mime_map.get(ext, "application/octet-stream")

        data = filepath.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        # YouTube embeds require a valid Referer; ensure the browser sends one
        if ext in (".html", ".htm"):
            self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        # Cleaner log output
        sys.stderr.write(f"[bander] {args[0]}\n")


def main():
    parser = argparse.ArgumentParser(description="Bander local server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"Port to listen on (default: {DEFAULT_PORT})")
    parser.add_argument("--bands-dir", type=str, default=str(ROOT / "bands"),
                        help="Path to the bands directory")
    args = parser.parse_args()

    BanderHandler.bands_dir = Path(args.bands_dir).resolve()
    BanderHandler.app_dir = (ROOT / "app").resolve()

    server = HTTPServer(("localhost", args.port), BanderHandler)
    print(f"Bander server running at http://localhost:{args.port}/")
    print(f"Bands directory: {BanderHandler.bands_dir}")
    print(f"Press Ctrl+C to stop.")
    print(f"NOTE: Use http://localhost:{args.port}/ (not 127.0.0.1) for YouTube embeds to work.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
