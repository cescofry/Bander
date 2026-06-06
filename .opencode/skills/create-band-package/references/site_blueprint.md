# Site Blueprint

Architecture guide for the Bander platform -- a generic, data-driven
website that renders band content from per-band JSON packages.

## High-Level Architecture

```
<project-root>/
  server.py               Python local server (stdlib, zero deps)
  app/                    Generic frontend SPA (shared by all bands)
    index.html
    assets/
      style.css
      app.js
  bands/                  Auto-scanned band packages
    <band-slug>/
      band.json           Required: core metadata
      members.json        Optional: array of member objects
      events.json         Optional: array of event objects
      videos.json         Optional: array of video objects
      albums.json         Optional: array of album objects
      theme.json          Optional: visual customization tokens
      assets/
        images/
          members/
          albums/
          events/
        logo.svg          Optional
        custom.css         Optional escape hatch
  .opencode/skills/          Project-local AI skills
```

## Server

A lightweight Python stdlib HTTP server (`server.py`).

### Endpoints

| Method | Path | Response |
|--------|------|----------|
| `GET`  | `/` | Serves `app/index.html` (SPA entry point) |
| `GET`  | `/app/<path>` | Static files under `app/` |
| `GET`  | `/api/bands` | JSON array of band summaries (slug, name, genres, formed, origin, description) |
| `GET`  | `/api/bands/<slug>` | Merged JSON payload for one band (band.json + split files + theme) |
| `GET`  | `/bands/<slug>/<path>` | Static assets inside a band package |

### Band Discovery

The server scans the `bands/` directory on each `/api/bands` request.
A subdirectory is recognized as a band if it contains `band.json`.
No explicit catalog file is needed.

## Frontend SPA

A single `index.html` page with two views, switched via hash routing.

### Routing

| Hash | View |
|------|------|
| `#/` or empty | Catalog view -- grid of available bands |
| `#/<slug>` | Band view -- full band page with tabs |

### Page Architecture

```
CATALOG VIEW
+----------------------------------------------------------+
|  Header: BANDER title + subtitle                         |
+----------------------------------------------------------+
|  Band Grid                                               |
|  [ Card: Pantera ]  [ Card: Metallica ]  [ Card: ... ]   |
+----------------------------------------------------------+

BAND VIEW
+----------------------------------------------------------+
|  Sticky Tab Navigation                                   |
|  [<-]  BAND NAME  [ Live ]  [ Chronology ]  [ The Band ] |
+----------------------------------------------------------+
|  Hero Section                                            |
|  Band name, tagline, visual motif                        |
+----------------------------------------------------------+
|  Tab Content Area                                        |
|  (only one panel visible at a time)                      |
+----------------------------------------------------------+
|  Footer                                                  |
|  Trivia / fun facts                                      |
+----------------------------------------------------------+
```

### Tab Switching Strategy

Tabs toggle `display: none` / `display: block` on content panel
`<div>` elements. This preserves YouTube iframe playback state when
switching tabs.

### Data Loading

When a band is selected:

1. Fetch `/api/bands/<slug>` -- returns merged JSON.
2. Apply theme tokens as CSS custom properties.
3. Update Google Fonts `<link>` if theme specifies custom fonts.
4. Render all sections from the JSON payload.
5. Image paths in JSON are relative to the band folder; the renderer
   prepends `/bands/<slug>/` to form the full URL.

## Section Responsibilities

### Hero
- Band name in display font.
- Tagline: genres, origin, active years.
- Visual motif driven by theme tokens (spotlight by default).

### Live Tab (default)
- Grid of YouTube video thumbnails with click-to-play.
- Each card: thumbnail + play button overlay + title + year + category badge.
- Clicking the play button replaces the thumbnail with an autoplaying iframe.
- Uses `youtube-nocookie.com` for privacy-enhanced embedding.
- The iframe is only created on user click to avoid YouTube's embed
  restrictions when serving from localhost.

### Chronology Tab
- Vertical timeline with central spine.
- Events alternate left/right.
- Category badges color-coded via theme tokens.
- Event images shown as thumbnails.

### The Band Tab
- One card per member.
- Portrait images, name, role, active period.
- Biography and side projects.
- Multiple images across eras when available.

### Footer
- Trivia items from `band.json`.

## Theming

The app uses CSS custom properties for all colors, fonts, and badge
colors. Default values are baked into `style.css`.

A band's `theme.json` overrides these at runtime:

- `colors` object -> `--color-*` properties
- `badges` object -> `--badge-*` properties
- `fonts` object -> `--font-heading`, `--font-body` + Google Fonts URL

This means every band shares the same layout and structure but can
have a distinct visual identity.

## Responsive Behavior

- Desktop: multi-column grids, side-by-side timeline.
- Tablet: reduced columns, stacked where needed.
- Mobile: single column, timeline collapses to left-aligned.
- Tab nav stays sticky at all sizes.
- YouTube iframes scale proportionally via padding-bottom aspect ratio.

## Image Fallback Strategy

Every rendered `<img>` tag includes an `onerror` handler that hides
the image and shows a fallback `<div>` with initials on a colored
background.
