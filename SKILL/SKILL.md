---
name: band-research
description: >-
  Research a band or musician and produce a data package for the Bander platform.
  Use when the user says "create a band package", "research a band",
  "add a band to Bander", "make an artist data pack",
  "build a music research package", "create a musician archive",
  "add a band", or "research an artist for Bander".
  For generic documentation pages use page-publisher-publish-page instead.
  For pure idea validation use idea-research instead.
---

# Band Research

Research a band or musician and produce a self-contained data package
that the Bander platform can render. The skill does **not** generate
HTML/CSS/JS -- it generates structured JSON data files, downloads images,
and produces design-direction tokens. The generic Bander app renders
everything at runtime.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| **Artist / band name** | Yes | The subject of the research. |
| **Project root** | No | Path to the Bander project root. Defaults to the current working directory. The band package will be created under `bands/<artist-slug>/`. |

Everything else uses locked defaults:

- **Output location**: `bands/<artist-slug>/` inside the project root.
- **Data files**: `band.json` (required), plus optional split files (`members.json`, `events.json`, `videos.json`, `albums.json`).
- **Theme**: `theme.json` with color palette, fonts, and visual tokens.
- **Images**: stored locally under `assets/images/` inside the band folder.
- **Videos**: always embedded YouTube. Never downloaded local video files.

## Band Package Contract

The skill produces a folder with this structure:

```
bands/<artist-slug>/
  band.json              Core metadata (required)
  members.json           Array of member objects
  events.json            Array of chronology events
  videos.json            Array of YouTube video references
  albums.json            Array of album objects
  theme.json             Visual customization tokens
  assets/
    images/
      members/           Localized member portraits
      albums/            Localized album cover art
      events/            Localized event images
    logo.svg             Optional band logo
```

See `references/content_schema.json` for the full JSON schema.

## Content Requirements

### band.json

Core metadata: name, slug, formed, dissolved, origin, genres, labels,
description, trivia. The `slug` must match the folder name.

### members.json

One entry per band member (or the solo artist plus key collaborators):

- Name, role, active period.
- 2-3 sentence bio focused on contribution to the band.
- Notable side projects.
- Multiple image paths across eras when available.

### events.json

Chronological events covering:

- Formation / origin story.
- Lineup changes.
- Album releases.
- Major milestones, accolades, controversies, turning points.

Each event: date, title, description, category, optional image,
optional members_involved.

### videos.json

8-12 YouTube video references spanning different eras:

- Most popular / iconic songs.
- Notable live performances.
- Official music videos.

Each video: title, youtube_url, category, year.

### albums.json

Studio albums with release year, description, and cover image path.

### theme.json

Visual direction tokens:

- `style`: name of the visual direction.
- `colors`: palette overrides (bg, accent, surface, text, etc.).
- `badges`: per-category badge color overrides.
- `fonts`: Google Fonts family names and weights.
- `hero`: hero section configuration (effect type, tagline separator).

## Workflow

Follow these steps in order. Mark each step in your todo list as you go.

### Step 1 -- Gather Inputs

Collect the artist/band name from the user. Determine the project root
(default: current working directory). Compute the slug from the artist
name (lowercase, hyphens, no special characters).

### Step 2 -- Research the Subject

Use web search, public knowledge, and any user-provided context to collect:

1. **Band / artist history** -- formation, breakups, reunions, key turning points.
2. **Lineup changes** -- who joined, who left, when, and why.
3. **Discography** -- studio albums with release dates.
4. **Major events** -- awards, controversies, landmark concerts.
5. **YouTube videos** -- search for official music videos, popular live
   performances, and representative tracks across eras. Collect at least
   8-12 video URLs.
6. **Images** -- identify image sources for later download in Step 6.
   Do **not** guess image content from filenames or download generic
   group photos. Use the strategies below to ensure each image
   unambiguously depicts the intended subject.

   **Member portraits** -- use the Wikipedia `pageimages` API to find
   the infobox portrait for each member's Wikipedia article. These are
   editorially curated single-person photos and are the most reliable
   source. Call:

   ```
   https://en.wikipedia.org/w/api.php?action=query
     &titles=<Member_Article_Title>
     &prop=pageimages&piprop=original&format=json
   ```

   The response `original.source` field contains the direct image URL.
   Record each member's article title and the returned image URL.

   Only use an image if the Wikipedia article exists and returns a
   result. If a member has no Wikipedia article or no infobox image,
   mark them for placeholder generation in Step 6.

   **Album covers** -- use the iTunes Search API to find official
   album artwork. First look up the artist ID:

   ```
   https://itunes.apple.com/search?term=<band>&entity=musicArtist&limit=5
   ```

   Then fetch all albums for that artist:

   ```
   https://itunes.apple.com/lookup?id=<artistId>&entity=album&limit=50
   ```

   Match album names from your research to the results and extract
   the `artworkUrl100` field, replacing `100x100bb` with `500x500bb`
   for a higher-resolution image. Record the URL for each matched
   album. Albums not found on iTunes (e.g. self-released demos)
   should have their `cover_image` set to `null`.

   **Event images** -- use album cover images for album-release events.
   For other events, set the `image` field to `null` unless a clearly
   attributable photo is found.
7. **Visual identity cues** -- these feed into Step 4's design analysis.
   Collect whatever is available from the following:
   - **Logo**: find the band's official logo image/SVG URL. Note its
     dominant colors, typography style (serif, sans, blackletter,
     custom), and visual weight (bold, delicate, ornate).
   - **Dominant palette**: colors frequently associated with the artist
     (album art motifs, stage lighting, merchandise themes).
   - **Genre mood**: adjectives that describe the sonic/visual culture
     of the genre(s) (e.g. aggressive, ethereal, psychedelic, raw,
     polished, chaotic, melancholic).
   - **Era and cultural context**: decade of peak activity, geographic
     scene, associated subcultures.
   - **Iconic imagery**: recurring visual motifs (skulls, nature,
     geometric patterns, lo-fi textures, neon, etc.).

Use `references/research_checklist.md` as a guide for sources to consult.

### Step 3 -- Build the Data Files

Organize all research into structured JSON files following the schema in
`references/content_schema.json`. Write them to `bands/<slug>/`.

The data files must contain at minimum:

- `band.json`: name, slug, formed, origin, genres, description, trivia.
- `members.json`: name, role, active period, bio, image paths.
- `events.json`: date, title, description, category, image path.
- `videos.json`: title, youtube URL, category, year.
- `albums.json`: title, year, description, cover image path.

Use `sources/artist_dossier_template.md` as a starting scaffold.

### Step 4 -- Plan the Visual Direction

Analyze the research collected in Step 2 to generate three band-specific
visual direction concepts. Each concept is a complete theme with colors,
fonts, and rationale derived from the artist's identity -- not from a
generic preset menu.

#### 4a. Build a Visual Analysis

From the research gathered in Step 2, synthesize a short design brief
covering:

- **Genre mood**: map the genre(s) to visual adjectives (e.g. groove
  metal -> aggressive, heavy, industrial; dream pop -> ethereal, hazy,
  pastel).
- **Logo palette**: if a logo was found, identify its dominant colors
  and typographic style.
- **Album art motifs**: recurring color schemes and visual themes across
  the discography (dark/light, warm/cool, photographic/illustrated).
- **Era context**: the decade(s) of peak activity inform typography and
  texture choices (70s -> serif, analog warmth; 90s -> grunge, raw
  sans-serif; 2000s+ -> clean, geometric).
- **Cultural scene**: origin and subculture cues (Scandinavian black
  metal -> frost, monochrome; LA glam -> neon, pink, excess; British
  post-punk -> grey, minimalist).
- **Iconic imagery**: any recurring motifs from merchandise, stage
  design, or album art (fire, skulls, nature, machinery, etc.).

#### 4b. Generate Three Visual Direction Concepts

Using the analysis from 4a, create three distinct concepts. Each must:

1. Have a unique, evocative **name** that references the band's identity
   (e.g. "Texas Steel Brutalism", "Roadcase Archive", "Arena Ember
   Assault" -- not generic names like "Dark Theme" or "Style A").
2. Include a **rationale** (2-3 sentences) explaining how the concept
   connects to the band's music, history, and visual identity.
3. Include a **recommended** flag -- set to `true` on the single concept
   you consider the strongest match.
4. Include a complete **theme** object matching the `theme.json` schema:
   - `style`: the concept name.
   - `colors`: `bg`, `bg_secondary`, `surface`, `text`, `text_muted`,
     `accent`, `accent_secondary`, `nav_bg`, `border`.
   - `badges`: per-category badge colors. These should harmonize with
     the concept palette while maintaining readability.
   - `fonts`: heading and body Google Font family names with weights.
     Choose fonts that reinforce the concept (e.g. bold condensed for
     aggression, elegant serif for archival, geometric sans for modern).
   - `hero`: `effect` descriptor, `tagline_separator`.

Ensure the three concepts are meaningfully different from each other --
vary at least two of: color temperature, typography class, and overall
brightness (light vs dark).

Write the three concepts to a temporary file:

```bash
cat > /tmp/style-candidates.json << 'CONCEPTS_EOF'
{
  "band_name": "<Artist Name>",
  "analysis_summary": "<2-3 sentence visual analysis>",
  "concepts": [
    {
      "name": "Concept Name",
      "rationale": "Why this fits the band...",
      "recommended": true,
      "theme": {
        "style": "Concept Name",
        "colors": { ... },
        "badges": { ... },
        "fonts": { ... },
        "hero": { ... }
      }
    },
    { ... },
    { ... }
  ]
}
CONCEPTS_EOF
```

#### 4c. Present the Concepts to the User

Open an interactive preview page so the user can see each concept
rendered with sample content and pick their preferred direction.

Run the style chooser script:

```bash
python3 <skill_dir>/scripts/style_chooser.py \
  --candidates /tmp/style-candidates.json \
  --output /tmp/music-site-style-choice.json
```

This will:

1. Read the candidates JSON for band name, rationale, and theme tokens.
2. Start a local HTTP server on `127.0.0.1:8787`.
3. Open the user's default browser to a page with three tabbed previews,
   each showing the concept name, rationale, and a rendered preview
   using that concept's actual colors and fonts.
4. The recommended concept tab is shown first.
5. Each tab has a **"Choose this style"** button.
6. The full chosen theme payload is written to the output JSON.

Parse the result:

```bash
STYLE=$(python3 -c "import json,sys; d=json.load(open('/tmp/music-site-style-choice.json')); print(d['style'])")
```

If the script times out (exit code 2 after 5 minutes), fall back to
describing all three concepts to the user via text and asking which
they prefer.

### Step 5 -- Generate theme.json

Read the chosen style from `/tmp/music-site-style-choice.json`. This
file contains the complete theme payload (colors, badges, fonts, hero)
that was selected in Step 4. Write it directly to
`bands/<slug>/theme.json`.

If the choice file is missing or corrupt, re-read the candidates from
`/tmp/style-candidates.json`, pick the recommended concept, and use
its theme payload instead.

### Step 6 -- Localize Images

Download images collected in Step 2 into the band folder under
`assets/images/`. All final image files **must be valid JPEG** data
saved with a `.jpg` extension so the server's MIME mapping
(`image/jpeg`) matches the actual file content. Do not save PNG data
with a `.jpg` extension -- browsers may refuse to render it.

Use descriptive, slug-based filenames:

```
assets/images/members/<member-slug>.jpg
assets/images/albums/<album-slug>.jpg
assets/images/events/<event-slug>.jpg
```

#### 6a. Download Member Portraits

For each member, download the Wikipedia infobox image URL collected
in Step 2. Use `curl -L` (or equivalent) with a descriptive
`User-Agent` header. Wikimedia enforces rate limits; add a 2-3 second
delay between requests. If a request returns HTTP 429, wait 5-10
seconds and retry up to twice.

After downloading, verify each file is a valid JPEG (check the file
magic bytes or use `file <path>`). If a download returned HTML or an
error page instead of image data, discard it and retry.

#### 6b. Download Album Covers

For each album matched to an iTunes URL in Step 2, download the
500x500 artwork using `curl -s`. iTunes artwork downloads are
reliable and do not typically require rate-limit handling.

For albums with no iTunes match (e.g. self-released demos, bootlegs),
set `cover_image` to `null` in `albums.json`. Do **not** create a
placeholder for album covers -- the app handles null covers with CSS
fallback styling.

#### 6c. Generate Initials Placeholders for Missing Members

For any member where no Wikipedia infobox image was found (or all
download attempts failed), generate a placeholder image using
Pillow (PIL):

1. Create a 400x400 JPEG with a dark background that matches the
   band's `theme.json` palette (use the `bg` or `surface` color).
2. Draw a centered circle in a slightly lighter shade.
3. Render the member's initials (first letter of first name + first
   letter of last name) centered inside the circle, using the theme's
   `accent` color.
4. Add a thin horizontal accent line below the circle.
5. Save as JPEG with quality 90.

Example (using Subliminal Autopsy theme):

```python
from PIL import Image, ImageDraw, ImageFont

img = Image.new('RGB', (400, 400), (30, 35, 38))
draw = ImageDraw.Draw(img)
draw.ellipse([120, 100, 280, 260], fill=(40, 46, 50), outline=(55, 63, 68), width=2)
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
# ... center initials, draw accent line ...
img.save("assets/images/members/<slug>.jpg", "JPEG", quality=90)
```

This ensures every member has a visible image in the rendered page.

#### 6d. Update JSON References

After all downloads and placeholder generation, update all JSON files
so every image path points to the local `assets/images/` copy:

- `members.json`: each member's `images` array.
- `events.json`: each event's `image` field (use the matching album
  cover path for album-release events; `null` for others).
- `albums.json`: each album's `cover_image` field.

### Step 7 -- Validate the Package

Run the validation script:

```bash
python3 <skill_dir>/scripts/validate_band_package.py bands/<slug>
```

The script checks for:

- `band.json` exists and has required fields.
- JSON files are valid and follow the schema.
- Referenced image files exist locally.
- YouTube URLs are well-formed.
- At least 3 members, 5 events, and 6 videos are present.

If validation fails, fix the issues and re-validate.

### Step 8 -- Report

Tell the user:

1. Where the band package was created (folder path).
2. How to run the server (`python3 server.py`) and open the site
   (`http://localhost:8888/`). Remind the user to use `localhost`
   (not `127.0.0.1`) for YouTube embeds to work.
3. Summary of content: number of videos, events, members, albums.
4. Any research gaps (missing images, limited video availability, etc.).

## Error Recovery

| Failure | Detection | Fix |
|---------|-----------|-----|
| Not enough reliable sources found | Package has fewer than 5 events or 3 videos | Warn the user; ask for additional context. Proceed with what is available. |
| Image download fails | HTTP error or timeout during Step 6 | For members: generate an initials placeholder (Step 6c). For albums: set `cover_image` to `null`. |
| Wikipedia API rate limit (HTTP 429) | Rate-limited response during member image lookup | Wait 5-10 seconds and retry up to twice. If all retries fail, generate an initials placeholder. |
| Wikipedia article not found | No infobox image returned for a member | Generate an initials placeholder (Step 6c). |
| iTunes album not found | Album name not matched in iTunes API results | Set `cover_image` to `null`. Common for self-released demos, bootlegs, and very early releases. |
| Downloaded file is not a valid image | `file` command shows HTML or other non-image data | Discard the file and retry with a longer delay. This typically happens when Wikimedia returns an error page instead of image data. |
| JPEG/PNG MIME mismatch | PNG data saved with `.jpg` extension | Re-download or re-generate the image. The server maps `.jpg` to `image/jpeg`; PNG data served as JPEG will fail to render in some browsers. |
| YouTube video unavailable | URL returns 404 | Replace with next-best video. Note the gap in the report. |
| Package missing required data | Validation script reports errors | Fix the JSON and re-validate. |
| Artist not found / too obscure | Research yields almost no results | Tell the user honestly. Ask if they can provide source material. |
| Style chooser times out | `style_chooser.py` exits with code 2 | Fall back to describing concepts via text and asking the user. |
| Style chooser port in use | Server fails to bind | The script auto-increments the port. If all fail, ask via text. |
| Candidates JSON missing | `style_chooser.py` exits with code 1 | Re-generate `/tmp/style-candidates.json` from Step 4b. |
| Pillow not available | ImportError when generating placeholders | Fall back to leaving the image path as `null`. The app shows initials via CSS fallback. |

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | This specification. |
| `references/content_schema.json` | JSON schema for band packages. |
| `references/site_blueprint.md` | Architecture guide for the Bander platform. |
| `references/design_patterns.md` | Reusable UI patterns. |
| `references/research_checklist.md` | Research source guide. |
| `scripts/style_chooser.py` | Interactive style direction picker (reads generated candidates). |
| `scripts/style_preview.html` | Data-driven style preview page template. |
| `scripts/generate_band_package_prompt.py` | Prompt builder for general agent delegation. |
| `scripts/validate_band_package.py` | Band package validator. |
| `sources/artist_dossier_template.md` | Starting scaffold for research. |
| `sources/sample_artist_brief.json` | Example brief. |
| `sources/public_source_guide.md` | Public source reference. |
| `tests/eval-prompts.md` | Evaluation prompts. |
