#!/usr/bin/env python3
"""Bander server.

Serves the generic frontend app and exposes a small API for band discovery.
All bands live under the ``bands/`` directory as self-contained packages.

Configuration is loaded from ``config.json`` in the project root.  CLI
arguments override config-file values.

Usage:
    python3 server.py [--port 8888] [--host 127.0.0.1] [--bands-dir ./bands]
                      [--base-path /bander] [--config config.json]

Endpoints (all prefixed with ``base_path``):
    GET  <base>/                       -> app/index.html (the SPA shell)
    GET  <base>/app/<path>             -> static files under app/
    GET  <base>/api/bands              -> JSON list of available band summaries
    GET  <base>/api/bands/<slug>       -> merged payload for one band
    GET  <base>/bands/<slug>/<path>    -> static assets inside a band package
    GET  <base>/healthz                -> health check
"""

import argparse
import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).parent.resolve()
DEFAULT_PORT = 8888
DEFAULT_HOST = "127.0.0.1"
DEFAULT_BASE_PATH = ""
DEFAULT_CONFIG_FILE = "config.json"


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def load_config(config_path: Path) -> dict:
    """Load config.json from the project root.  Returns {} on missing/invalid."""
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[bander] Warning: could not parse {config_path}: {exc}",
              file=sys.stderr)
        return {}


def normalize_base_path(raw: str) -> str:
    """Ensure base_path starts with ``/`` and has no trailing slash.

    An empty or ``/`` value means the app is served at the domain root.
    """
    bp = raw.strip().rstrip("/")
    if bp and not bp.startswith("/"):
        bp = "/" + bp
    return bp  # e.g. "/bander" or ""


# ---------------------------------------------------------------------------
# Threaded server (handles concurrent requests behind nginx)
# ---------------------------------------------------------------------------

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


# ---------------------------------------------------------------------------
# Request handler
# ---------------------------------------------------------------------------

class BanderHandler(SimpleHTTPRequestHandler):
    """Route requests to the app shell, API, or band assets."""

    bands_dir: Path = ROOT / "bands"
    app_dir: Path = ROOT / "app"
    base_path: str = ""                # e.g. "/bander"
    runtime_config: dict = {}          # injected into index.html

    # -----------------------------------------------------------------
    # Routing
    # -----------------------------------------------------------------

    def do_GET(self):
        raw_path = unquote(urlparse(self.path).path)

        bp = self.base_path  # e.g. "/bander"

        # Requests must start with the base path (or be the base without /)
        if bp:
            if raw_path == bp or raw_path == bp + "/":
                path = "/"
            elif raw_path.startswith(bp + "/"):
                path = raw_path[len(bp):]  # strip prefix, keep leading /
            else:
                self._send_error(404, {"error": "Not found"})
                return
        else:
            path = raw_path

        # Health check
        if path == "/healthz":
            self._send_json({"status": "ok"})
            return

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
            rel = path[len("/bands/"):]
            self._serve_safe_file(self.bands_dir, rel)
            return

        # App static assets
        if path.startswith("/app/"):
            rel = path[len("/app/"):]
            self._serve_safe_file(self.app_dir, rel)
            return

        # Root -> serve app/index.html (SPA entry) with injected config
        if path == "/" or path == "/index.html":
            self._serve_index()
            return

        # Fallback: try under app/ (for direct asset references)
        rel = path.lstrip("/")
        candidate = self.app_dir / rel
        resolved = candidate.resolve()
        if resolved.exists() and resolved.is_file() and self._is_inside(resolved, self.app_dir):
            self._serve_file(resolved)
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

    # -----------------------------------------------------------------
    # Safe file serving (path-traversal protection)
    # -----------------------------------------------------------------

    @staticmethod
    def _is_inside(resolved: Path, root: Path) -> bool:
        """Return True if *resolved* is inside *root*."""
        try:
            resolved.relative_to(root.resolve())
            return True
        except ValueError:
            return False

    def _serve_safe_file(self, root: Path, rel_path: str):
        """Serve a file from *root* / *rel_path* only if it stays inside root."""
        candidate = (root / rel_path).resolve()
        if not candidate.exists() or not candidate.is_file():
            self._send_error(404, {"error": "Not found"})
            return
        if not self._is_inside(candidate, root):
            self._send_error(403, {"error": "Forbidden"})
            return
        self._serve_file(candidate)

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

    # -----------------------------------------------------------------
    # Index serving with injected runtime config
    # -----------------------------------------------------------------

    def _serve_index(self):
        """Serve app/index.html with runtime config injected."""
        index_path = self.app_dir / "index.html"
        if not index_path.exists():
            self._send_error(404, {"error": "index.html not found"})
            return

        html = index_path.read_text(encoding="utf-8")

        # Inject runtime config as a <script> block before </head>
        config_json = json.dumps(self.runtime_config, ensure_ascii=False)
        config_script = (
            f'<script>window.BANDER_CONFIG = {config_json};</script>'
        )
        html = html.replace("</head>", config_script + "\n</head>", 1)

        # Rewrite absolute asset paths in HTML to use base_path
        bp = self.base_path
        if bp:
            html = html.replace('href="/app/', f'href="{bp}/app/')
            html = html.replace('src="/app/', f'src="{bp}/app/')

        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Cleaner log output
        sys.stderr.write(f"[bander] {args[0]}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Bander server")
    parser.add_argument("--config", type=str, default=str(ROOT / DEFAULT_CONFIG_FILE),
                        help=f"Path to config file (default: {DEFAULT_CONFIG_FILE})")
    parser.add_argument("--port", type=int, default=None,
                        help="Port to listen on (overrides config file)")
    parser.add_argument("--host", type=str, default=None,
                        help="Host/address to bind to (overrides config file)")
    parser.add_argument("--bands-dir", type=str, default=None,
                        help="Path to the bands directory (overrides config file)")
    parser.add_argument("--base-path", type=str, default=None,
                        help="URL prefix, e.g. /bander (overrides config file)")
    args = parser.parse_args()

    # Load config file
    config_path = Path(args.config).resolve()
    cfg = load_config(config_path)
    if cfg:
        print(f"[bander] Loaded config from {config_path}")
    else:
        print(f"[bander] No config loaded (using defaults)")

    # Resolve values: CLI > config file > defaults
    host = args.host or cfg.get("host", DEFAULT_HOST)
    port = args.port if args.port is not None else cfg.get("port", DEFAULT_PORT)
    bands_dir = args.bands_dir or cfg.get("bands_dir", str(ROOT / "bands"))
    base_path = normalize_base_path(
        args.base_path if args.base_path is not None else cfg.get("base_path", DEFAULT_BASE_PATH)
    )
    public_base_url = cfg.get("public_base_url", "")
    github_issues_url = cfg.get("github_issues_url",
                                "https://github.com/cescofry/Bander/issues/new")

    # Configure handler
    BanderHandler.bands_dir = Path(bands_dir).resolve()
    BanderHandler.app_dir = (ROOT / "app").resolve()
    BanderHandler.base_path = base_path
    BanderHandler.runtime_config = {
        "basePath": base_path,
        "publicBaseUrl": public_base_url,
        "githubIssuesUrl": github_issues_url,
    }

    server = ThreadingHTTPServer((host, port), BanderHandler)

    url = f"http://{host}:{port}{base_path}/"
    print(f"[bander] Bander server running at {url}")
    print(f"[bander] Bands directory: {BanderHandler.bands_dir}")
    if base_path:
        print(f"[bander] Base path: {base_path}")
    print(f"[bander] Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[bander] Shutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
