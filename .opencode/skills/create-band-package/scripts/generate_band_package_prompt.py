#!/usr/bin/env python3
"""Generate a normalized prompt for a general agent to produce a band package.

Reads research context and user choices, then prints a comprehensive
prompt to stdout that a general-purpose agent can execute to produce
the JSON data files, download images, and create theme.json.

Usage:
    python3 generate_band_package_prompt.py \
        --artist "Pink Floyd" \
        --output "./bands/pink-floyd" \
        --theme-file /tmp/music-site-style-choice.json

    # Or pass theme JSON inline:
    python3 generate_band_package_prompt.py \
        --artist "Pink Floyd" \
        --output "./bands/pink-floyd" \
        --theme-json '{"style":"Concept Name","colors":{...}}'
"""

import argparse
import json
import sys
import textwrap
from pathlib import Path


# ---------------------------------------------------------------------------
# Default theme -- used only as a final fallback if no theme is provided
# ---------------------------------------------------------------------------

DEFAULT_THEME = {
    "style": "Default",
    "colors": {
        "bg": "#0a0a1a",
        "bg_secondary": "#111128",
        "surface": "#1a1a2e",
        "text": "#e0e0e0",
        "text_muted": "#888",
        "accent": "#4fc3f7",
        "accent_secondary": "#7c4dff",
        "nav_bg": "rgba(10, 10, 26, 0.95)",
        "border": "rgba(255, 255, 255, 0.08)"
    },
    "fonts": {
        "heading": "Montserrat",
        "body": "Inter",
        "heading_weights": "400;600;700;800;900",
        "body_weights": "300;400;500;600"
    },
    "hero": {"effect": "spotlight", "tagline_separator": "|"}
}


def load_theme(args) -> dict:
    """Load theme from --theme-file, --theme-json, or fall back to default."""
    if args.theme_file:
        p = Path(args.theme_file)
        if p.exists():
            try:
                with open(p) as f:
                    theme = json.load(f)
                if isinstance(theme, dict) and ("colors" in theme or "style" in theme):
                    return theme
            except (json.JSONDecodeError, IOError):
                pass
        print(f"WARNING: Could not load theme from {args.theme_file}, using default.",
              file=sys.stderr)

    if args.theme_json:
        try:
            theme = json.loads(args.theme_json)
            if isinstance(theme, dict):
                return theme
        except json.JSONDecodeError:
            pass
        print("WARNING: Could not parse --theme-json, using default.",
              file=sys.stderr)

    return DEFAULT_THEME


def build_prompt(artist: str, output: str, theme: dict) -> str:
    """Build the prompt for a general agent to produce the band package."""
    theme_json = json.dumps(theme, indent=2)

    prompt = textwrap.dedent(f"""\
    Create a band data package for "{artist}" at: {output}/

    ## What to Produce

    This is a DATA PACKAGE, not a website. You are producing JSON files
    and downloading images. The Bander app will render everything.

    ## Output Structure

    ```
    {output}/
      band.json              Core metadata
      members.json           Array of member objects
      events.json            Array of chronology events
      videos.json            Array of YouTube video refs
      albums.json            Array of album objects
      theme.json             Visual customization tokens
      assets/
        images/
          members/           Member portraits
          albums/            Album cover art
          events/            Event photos
    ```

    ## Data Requirements

    ### band.json
    - name: full band/artist name
    - slug: URL-safe folder name (must match the folder)
    - formed: year
    - dissolved: year (if applicable)
    - origin: city, country
    - genres: array of genre strings
    - labels: array of record label names
    - description: 2-3 sentence overview
    - trivia: array of 5-7 fun fact strings

    ### members.json
    Array of objects. Each member needs:
    - name, role, active_period, bio (2-3 sentences),
      side_projects (array), images (array of relative paths)

    ### events.json
    Array of chronology events. At least 10 events covering formation,
    albums, lineup changes, milestones. Each needs:
    - date (ISO or year), title, description, category
      (formation/album_release/lineup_change/milestone/controversy/
       breakup/reunion/death/other), image (relative path or null),
      members_involved (array of names)

    ### videos.json
    Array of 8-12 YouTube videos. Each needs:
    - title, youtube_url (full URL), category (official/live/other), year

    ### albums.json
    Array of studio albums. Each needs:
    - title, year, description (1-2 sentences), cover_image (relative path)

    ### theme.json
    Use this exact content (generated from the band's visual analysis):
    ```json
    {theme_json}
    ```

    ## Image Rules
    - Download images to assets/images/members/, albums/, events/
    - Use descriptive slugified filenames
    - All image paths in JSON must be relative to the band folder
      (e.g. "assets/images/members/john-doe.jpg")
    - If an image cannot be downloaded, set the path to null

    ## Video Rules
    - Always use full YouTube URLs (https://www.youtube.com/watch?v=...)
    - Never download video files locally
    - Include a mix of official videos and live performances
    """)

    return prompt


def main():
    parser = argparse.ArgumentParser(description="Generate a band package prompt.")
    parser.add_argument("--artist", required=True, help="Artist or band name.")
    parser.add_argument("--output", required=True, help="Output folder for the band package.")
    parser.add_argument("--theme-file", default=None,
                        help="Path to theme JSON file (output of style_chooser.py).")
    parser.add_argument("--theme-json", default=None,
                        help="Theme JSON string (alternative to --theme-file).")
    # Keep --style for backward compatibility but ignore it
    parser.add_argument("--style", default=None,
                        help="DEPRECATED. Ignored. Use --theme-file instead.")
    args = parser.parse_args()

    if args.style and not args.theme_file and not args.theme_json:
        print("WARNING: --style is deprecated. The theme is now generated from "
              "band analysis in Step 4. Using default theme.", file=sys.stderr)

    theme = load_theme(args)
    prompt = build_prompt(args.artist, args.output, theme)
    print(prompt)


if __name__ == "__main__":
    main()
