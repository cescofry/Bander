#!/usr/bin/env python3
"""Launch the style preview page with generated candidate concepts.

Reads a candidates JSON file (produced by the skill's Step 4b), injects
the data into the preview HTML template, serves it locally, and waits
for the user to click a "Choose" button. The full chosen theme payload
is written to the output JSON file.

Usage:
    python3 style_chooser.py \
        --candidates /tmp/style-candidates.json \
        [--output /path/to/choice.json] \
        [--port 8787]

The candidates JSON must have the shape:
    {
      "band_name": "...",
      "analysis_summary": "...",
      "concepts": [
        {
          "name": "...",
          "rationale": "...",
          "recommended": true|false,
          "theme": { ... full theme.json payload ... }
        },
        ...
      ]
    }

The script exits automatically once a choice is received.
Timeout: 5 minutes (exits with code 2 if no choice is made).
Exit code 1 if the candidates file is missing or invalid.
"""

import argparse
import http.server
import json
import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
PREVIEW_HTML = SCRIPT_DIR / "style_preview.html"
DEFAULT_PORT = 8787
TIMEOUT_SECONDS = 300  # 5 minutes

PLACEHOLDER = '/*__CANDIDATES_JSON__*/ {"band_name":"Artist","analysis_summary":"","concepts":[]}'

choice_received = threading.Event()
selected_theme = None


def load_candidates(path: str) -> dict:
    """Load and validate the candidates JSON file."""
    p = Path(path)
    if not p.exists():
        print(f"ERROR: Candidates file not found: {path}", file=sys.stderr)
        sys.exit(1)
    try:
        with open(p) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in candidates file: {e}", file=sys.stderr)
        sys.exit(1)

    if "concepts" not in data or not isinstance(data["concepts"], list):
        print("ERROR: Candidates JSON must have a 'concepts' array.", file=sys.stderr)
        sys.exit(1)

    if len(data["concepts"]) == 0:
        print("ERROR: Candidates JSON has zero concepts.", file=sys.stderr)
        sys.exit(1)

    return data


def build_html(candidates: dict) -> bytes:
    """Inject candidate data into the preview HTML template."""
    template = PREVIEW_HTML.read_text(encoding="utf-8")
    candidates_json = json.dumps(candidates, ensure_ascii=False)
    # Replace the placeholder with real data
    html = template.replace(PLACEHOLDER, candidates_json)
    return html.encode("utf-8")


class StyleHandler(http.server.BaseHTTPRequestHandler):
    """Serves the preview HTML and handles the selection POST."""

    html_bytes = b""  # set before server starts

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(self.html_bytes)))
            self.end_headers()
            self.wfile.write(self.html_bytes)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        global selected_theme
        if self.path == "/select":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                selected_theme = json.loads(body)
            except json.JSONDecodeError:
                selected_theme = {"style": body.decode("utf-8", errors="replace")}

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())

            # Signal the main thread
            choice_received.set()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress request logs
        pass


def find_free_port(start: int) -> int:
    """Try the given port, increment if busy."""
    import socket
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start  # fallback


def main():
    global selected_theme

    parser = argparse.ArgumentParser(description="Launch style preview chooser.")
    parser.add_argument("--candidates", required=True,
                        help="Path to the candidates JSON file (from Step 4b).")
    parser.add_argument("--output", default=None,
                        help="Path to write the choice JSON (default: print to stdout only).")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"HTTP port (default: {DEFAULT_PORT}).")
    args = parser.parse_args()

    candidates = load_candidates(args.candidates)
    html_bytes = build_html(candidates)

    StyleHandler.html_bytes = html_bytes

    port = find_free_port(args.port)

    server = http.server.HTTPServer(("127.0.0.1", port), StyleHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    url = f"http://127.0.0.1:{port}/"
    print(f"Opening style preview at {url}", file=sys.stderr)

    # Open in default browser
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            webbrowser.open(url)
    except Exception:
        webbrowser.open(url)

    # Wait for selection or timeout
    got_choice = choice_received.wait(timeout=TIMEOUT_SECONDS)

    server.shutdown()

    if not got_choice:
        print("ERROR: Timed out waiting for style selection.", file=sys.stderr)
        sys.exit(2)

    result = selected_theme

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Choice written to {output_path}", file=sys.stderr)

    # Print to stdout so the calling skill can capture it
    print(json.dumps(result))


if __name__ == "__main__":
    main()
