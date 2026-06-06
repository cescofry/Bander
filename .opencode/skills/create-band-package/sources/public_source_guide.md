# Public Source Guide

Where to find publicly available facts, images, and videos for artist
research. Organized by content type.

## Facts & Biography

| Source | URL Pattern | What You Get |
|--------|------------|--------------|
| Wikipedia | `en.wikipedia.org/wiki/<Artist>` | Core biography, discography, lineup history, references |
| AllMusic | `allmusic.com/artist/<id>` | Discography, genre classification, related artists |
| MusicBrainz | `musicbrainz.org/artist/<id>` | Structured metadata, release groups, relationships |
| Discogs | `discogs.com/artist/<id>` | Detailed release history, label info, credits |
| Rock & Roll Hall of Fame | `rockhall.com/inductees` | Induction year, citation, legacy |
| Songkick / Setlist.fm | `setlist.fm/setlists/<artist>` | Concert history, setlists, venues |

**Tips:**
- Always cross-reference dates between Wikipedia and at least one other source.
- Use Wikipedia's reference links to find primary sources.
- MusicBrainz is the most structured source for metadata.

## Images

| Source | License | Notes |
|--------|---------|-------|
| **Wikimedia Commons** | CC / Public Domain | Best for freely reusable images. Search at `commons.wikimedia.org`. |
| Official artist website | Varies | Often has press photos. Check usage terms. |
| Wikipedia article images | CC / Fair Use | Already vetted for licensing; check individual image pages. |

**How to find good Wikimedia images:**
1. Go to `commons.wikimedia.org`
2. Search for the artist name
3. Filter by category (e.g., "Category:Pink Floyd")
4. Check the license on each image page
5. Prefer images with CC-BY-SA or public domain licenses

**Image localization:**
- Download each image into `assets/images/<category>/`
- Use descriptive filenames: `roger-waters-1977.jpg` not `img_001.jpg`
- Keep original resolution but consider compressing for web use

## Videos

| Source | Notes |
|--------|-------|
| **YouTube (official channel)** | Highest priority. Search `<artist> official` on YouTube. |
| YouTube (label channels) | Major labels host official videos (e.g., Columbia Records). |
| YouTube (VEVO)| VEVO channels host official music videos for many artists. |

**How to find good videos:**
1. Search YouTube for `<artist> official music video`
2. Look for the artist's verified channel (checkmark badge)
3. Sort by view count to find the most popular tracks
4. Search `<artist> live` for concert footage
5. Look for historically significant performances (festivals, TV appearances)

**Embedding:**
- Use `youtube-nocookie.com` domain for privacy-enhanced embedding:
  ```
  https://www.youtube-nocookie.com/embed/<VIDEO_ID>
  ```
- Extract VIDEO_ID from URLs:
  - `youtube.com/watch?v=VIDEO_ID`
  - `youtu.be/VIDEO_ID`

## What NOT to Use

- Fan-uploaded concert recordings (quality and legality issues)
- Images from commercial stock photo sites without a license
- Copyrighted press photos from news agencies (AP, Getty, etc.)
- Social media posts without explicit permission
- Content from fan wikis without cross-referencing against primary sources
