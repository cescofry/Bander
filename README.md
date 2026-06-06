# Bander

A local platform for exploring bands -- their music videos, history, and members.

The project is split into two parts:

1. **The website** -- a generic single-page app served by a small local Python server. It discovers bands automatically, renders a catalog page, and displays any selected band using a shared layout.
2. **The skill** -- an AI agent workflow that researches a band and produces a self-contained data package (JSON files + images + theme tokens). The skill does not generate HTML or CSS; the website handles all rendering.

## Quick Start

```bash
# Start the server (Python 3, no dependencies needed)
python3 server.py

# Open in your browser
open http://localhost:8888/
```

The catalog page lists every band found under `bands/`. Click one to see its full page.

The server reads `config.json` from the project root on startup. See [Configuration](#configuration) for all available options.

### Server Options

```bash
python3 server.py --port 9000              # use a different port
python3 server.py --bands-dir /path/to/bands  # point to a different bands folder
python3 server.py --base-path /bander      # serve under a URL prefix
python3 server.py --host 0.0.0.0           # bind to all interfaces
python3 server.py --config /etc/bander.json  # use a custom config path
```

CLI arguments override values from `config.json`.

## Project Structure

```
Bander/
  server.py                  HTTP server (Python stdlib, zero deps)
  config.json                Runtime configuration (port, host, base_path, etc.)
  app/                       Generic frontend (shared by all bands)
    index.html               SPA entry point
    assets/
      app.js                 Band discovery, data loading, rendering
      style.css              Shared stylesheet (CSS custom properties)
  bands/                     Band packages (auto-scanned by the server)
    pantera/                 Example: Pantera
      band.json              Core metadata (required)
      members.json           Band members
      events.json            Chronology events
      videos.json            YouTube video references
      albums.json            Discography
      theme.json             Visual customization tokens
      assets/
        images/
          members/           Member portraits
          albums/            Album covers
          events/            Event photos
  deploy/                    Deployment examples
    nginx.conf.example       nginx reverse-proxy config
  .opencode/skills/          Project-local AI skills
    create-band-package/     Researches a band and produces a data package
    plan-work/               Plans and organizes Bander project work
```

## How It Works

### The Server

`server.py` is a lightweight HTTP server built on Python's standard library. It does three things:

- **Serves the frontend** -- any request to `/` returns `app/index.html`. Static assets under `app/` are served at `/app/...`.
- **Provides a band discovery API** -- scans the `bands/` directory for subfolders that contain a `band.json` file.
- **Serves band assets** -- images and other files inside a band package are served at `/bands/<slug>/...`.

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | SPA entry point (`app/index.html`) |
| `GET` | `/app/<path>` | Static files from `app/` |
| `GET` | `/api/bands` | JSON array of all available bands (slug, name, genres, origin, etc.) |
| `GET` | `/api/bands/<slug>` | Full merged payload for one band -- `band.json` contents plus all split files (`members.json`, `events.json`, etc.) and `theme.json` merged into a single object |
| `GET` | `/bands/<slug>/<path>` | Static assets inside a band package (images, logo, custom CSS) |

### The Frontend

The app is a single-page application with hash-based routing. No build tools or frameworks -- plain HTML, CSS, and JavaScript.

#### Two Views

- **Catalog** (`http://localhost:8888/`) -- fetches `/api/bands` and renders a card grid. Each card shows the band name, genres, origin, and a short description.
- **Band page** (`http://localhost:8888/#/pantera`) -- fetches `/api/bands/pantera`, applies the band's theme, and renders three stacked sections on a single scrollable page:
  - **Live** -- a single YouTube player with a scrollable playlist sidebar; clicking a playlist item switches the player, and the next video plays automatically when the current one ends
  - **The Band** -- member cards with portraits, bios, and side projects
  - **Chronology** -- vertical timeline with color-coded event cards

A sticky navigation bar at the top lets you jump directly to any section; the active button updates automatically as you scroll. A back button in the nav returns to the catalog.

#### Theming

The stylesheet uses CSS custom properties for every color, font, and badge color. Default values are defined in `style.css`. When a band is loaded, its `theme.json` tokens override these properties at runtime, so every band shares the same layout but gets a distinct visual identity.

The app also updates the Google Fonts `<link>` tag dynamically if the theme specifies different font families.

#### Single-Page Layout

All three content sections (Live, The Band, Chronology) are rendered as stacked blocks on a single scrollable page. The sticky top navigation bar acts as a jump menu -- clicking a section name smooth-scrolls to it. An `IntersectionObserver` keeps the active nav button in sync with whichever section is currently in view.

#### YouTube Player and Localhost (Local Dev)

YouTube rejects embedded iframes when the browser's `Referer` header contains a raw IP address (e.g. `127.0.0.1`). For **local development**, the app handles this in two ways:

1. **`localhost` binding** -- the server binds to `localhost` by default.
2. **Auto-redirect** -- if you open the site via `http://127.0.0.1:8888/`, the app automatically redirects to `http://localhost:8888/`.

When deployed publicly behind nginx on a real domain, this is not an issue -- YouTube accepts domain-based referrers.

Always access the site at `http://localhost:<port>/` for local YouTube playback to work.

## Band Package Format

A band package is a folder under `bands/` with at least a `band.json` file. The server recognizes it automatically.

### Required File

**`band.json`** -- core metadata:

```json
{
  "name": "Pantera",
  "slug": "pantera",
  "formed": "1981",
  "dissolved": "2003",
  "origin": "Arlington, Texas, U.S.",
  "genres": ["Groove Metal", "Thrash Metal"],
  "labels": ["Atco", "Elektra"],
  "description": "Short overview of the band.",
  "trivia": ["Fun fact 1", "Fun fact 2"]
}
```

The `slug` must match the folder name.

### Optional Data Files

These are arrays of objects, loaded and merged by the server when a band is requested:

| File | Contents |
|------|----------|
| `members.json` | Band members -- name, role, active period, bio, side projects, image paths |
| `events.json` | Chronology -- date, title, description, category, image, members involved |
| `videos.json` | YouTube references -- title, URL, category (official/live/other), year |
| `albums.json` | Discography -- title, year, description, cover image path |

### Theme File

**`theme.json`** -- visual customization tokens (all fields optional):

```json
{
  "style": "Cinematic Dark Stage",
  "colors": {
    "bg": "#0a0a1a",
    "accent": "#4fc3f7",
    "surface": "#1a1a2e",
    "text": "#e0e0e0"
  },
  "badges": {
    "album_release": "#00bcd4",
    "lineup_change": "#e91e63",
    "milestone": "#ffc107"
  },
  "fonts": {
    "heading": "Montserrat",
    "body": "Inter",
    "heading_weights": "400;600;700;800;900",
    "body_weights": "300;400;500;600"
  },
  "hero": {
    "effect": "spotlight",
    "tagline_separator": "|"
  }
}
```

Available color tokens: `bg`, `bg_secondary`, `surface`, `text`, `text_muted`, `accent`, `accent_secondary`, `nav_bg`, `border`.

Badge tokens map to event/video categories: `formation`, `album_release`, `lineup_change`, `milestone`, `controversy`, `breakup`, `reunion`, `death`, `official`, `live`, `interview`, `documentary`, `other`.

### Assets

Images go under `assets/images/` within the band folder, organized into `members/`, `albums/`, and `events/` subdirectories. All image paths in JSON files are relative to the band folder root (e.g. `assets/images/members/phil-anselmo.jpg`). The frontend prepends `/bands/<slug>/` at render time to form the full URL.

All image files must be **valid JPEG data** with a `.jpg` extension. Do not save PNG data with a `.jpg` extension -- the server maps `.jpg` to `image/jpeg` and browsers may refuse to render mismatched content.

**Image sourcing**: Member portraits are sourced from Wikipedia infobox photos (via the `pageimages` API), which are editorially curated single-person images. Album covers come from iTunes artwork (via the iTunes Search API). When no photo is available for a member, the skill generates a themed initials placeholder using Pillow.

Missing images (paths set to `null` in JSON) are handled gracefully -- the app shows a fallback with the subject's initials on a colored background.

### Full Schema

See `.opencode/skills/create-band-package/references/content_schema.json` for the complete JSON schema covering all files and fields.

## Adding a Band

### Manually

1. Create a folder under `bands/` with a URL-safe name (lowercase, hyphens):
   ```bash
   mkdir -p bands/led-zeppelin/assets/images/{members,albums,events}
   ```

2. Create `band.json` with at least `name` and `slug`.

3. Add data files (`members.json`, `events.json`, `videos.json`, `albums.json`) and a `theme.json`.

4. Place images under `assets/images/` and reference them in the JSON files.

5. Validate:
   ```bash
   python3 .opencode/skills/create-band-package/scripts/validate_band_package.py bands/led-zeppelin
   ```

6. Restart the server (or it picks up the new folder on the next `/api/bands` request).

### Using the Skill

The `create-band-package` skill automates research and package creation. Trigger it with prompts like:

- "Add a band -- Led Zeppelin"
- "Research Queen for Bander"
- "Create a band package for Radiohead"

The skill will:
1. Research the band (history, members, discography, videos, images).
2. Build structured JSON files following the schema.
3. Present style direction choices and generate `theme.json`.
4. Download real images:
   - **Member portraits** from Wikipedia infobox photos (via the `pageimages` API).
   - **Album covers** from iTunes artwork (via the iTunes Search API).
   - **Initials placeholders** generated with Pillow for any member with no available photo.
5. Validate the package.

See `.opencode/skills/create-band-package/SKILL.md` for the full workflow specification.

## Validation

Validate a band package against the data contract:

```bash
python3 .opencode/skills/create-band-package/scripts/validate_band_package.py bands/pantera
```

Checks performed:
- `band.json` exists with required fields (`name`, `slug`)
- Slug matches the folder name
- All JSON files are valid and parseable
- Minimum content thresholds (3+ members, 5+ events, 6+ videos)
- YouTube URLs are well-formed
- Referenced image files exist locally
- Theme has color and font tokens

## Style Directions

Visual themes are **generated from the band's identity**, not picked
from a fixed menu. During package creation the skill analyzes the
artist's genre, logo palette, album art motifs, era, and cultural
context, then produces three bespoke visual direction concepts -- each
with a unique name, rationale, and complete color/font/badge tokens.

The interactive style chooser (`.opencode/skills/create-band-package/scripts/style_chooser.py`)
opens a browser preview of all three concepts so the user can compare
them side by side before confirming. The chosen theme is written
directly to `theme.json`.

Example concepts (for a groove metal band from Texas):

| Concept | Description |
|---------|-------------|
| **Texas Steel Brutalism** | Dark industrial palette, metallic accent tones, bold condensed headings |
| **Roadcase Archive** | Warm sepia tones, vintage serif headings, analog texture feel |
| **Arena Ember Assault** | Deep blacks with fire-orange accents, aggressive sans-serif headings |

Custom themes beyond generated concepts are supported by editing
`theme.json` directly.

## Configuration

The server reads `config.json` from the project root on startup. All fields are optional -- defaults are used for anything omitted.

```json
{
  "host": "127.0.0.1",
  "port": 8888,
  "bands_dir": "./bands",
  "base_path": "/bander",
  "public_base_url": "https://example.com/bander",
  "github_issues_url": "https://github.com/cescofry/Bander/issues/new"
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `host` | `127.0.0.1` | Address to bind to. Use `127.0.0.1` behind a reverse proxy. |
| `port` | `8888` | Port to listen on. |
| `bands_dir` | `./bands` | Path to the bands directory (relative to project root). |
| `base_path` | `""` (root) | URL prefix for all routes, e.g. `/bander`. |
| `public_base_url` | `""` | Full public URL for display/links (informational). |
| `github_issues_url` | GitHub URL | URL for the "Request a band" feature. |

CLI arguments (`--port`, `--host`, `--bands-dir`, `--base-path`, `--config`) override config file values.

To use a config file at a different path:

```bash
python3 server.py --config /etc/bander/config.json
```

## Deployment

The server is designed to run behind an nginx reverse proxy on a public server.

### Setup

1. Clone the repository on your server.

2. Edit `config.json` with your deployment settings:

   ```json
   {
     "host": "127.0.0.1",
     "port": 8888,
     "base_path": "/bander",
     "public_base_url": "https://yourdomain.com/bander",
     "github_issues_url": "https://github.com/cescofry/Bander/issues/new"
   }
   ```

3. Configure nginx using `deploy/nginx.conf.example` as a starting point.
   Add the `location` block to your existing `server {}` configuration:

   ```nginx
   location /bander/ {
       proxy_pass http://127.0.0.1:8888/bander/;
       proxy_set_header Host              $host;
       proxy_set_header X-Real-IP         $remote_addr;
       proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header X-Forwarded-Host  $host;
   }

   location = /bander {
       return 301 /bander/;
   }
   ```

4. Start the server:

   ```bash
   python3 server.py
   ```

5. Reload nginx:

   ```bash
   sudo nginx -t && sudo nginx -s reload
   ```

6. Visit `https://yourdomain.com/bander/` to verify.

### Health Check

The server exposes a health endpoint at `<base_path>/healthz` (e.g. `/bander/healthz`).
It returns `{"status": "ok"}` with a 200 response. Use this for monitoring or load-balancer checks.

### Process Management

For production, run the server under a process manager so it restarts on failure. Example with systemd:

```ini
[Unit]
Description=Bander server
After=network.target

[Service]
WorkingDirectory=/path/to/Bander
ExecStart=/usr/bin/python3 server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Security Notes

- The server validates that all static file requests resolve inside the `app/` or `bands/` directories. Path-traversal attempts are rejected.
- Bind to `127.0.0.1` (the default) when running behind nginx. Do not bind to `0.0.0.0` unless you have a firewall blocking direct access to the app port.
- Configure SSL/TLS termination in nginx, not in the Python server.
