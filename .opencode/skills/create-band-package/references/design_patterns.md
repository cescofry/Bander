# Design Patterns

Reusable UI patterns for music artist sites. These are generic patterns
extracted from successful artist site builds -- they are not tied to any
specific band or musician.

## Hero Section

A full-width section at the top of the page that establishes the visual
identity.

```
+----------------------------------------------------------+
|                                                          |
|              A R T I S T   N A M E                       |
|              genre | formed year | origin                |
|                                                          |
+----------------------------------------------------------+
```

**Implementation notes:**
- Use the heading font at a very large size (4-6rem desktop, 2-3rem mobile).
- Apply a visual motif that matches the chosen style direction:
  - Gradient overlay
  - Particle/starfield background (CSS or lightweight JS)
  - Textured background image
  - Geometric shapes or light effects
- Keep text content minimal -- name + tagline only.
- Add a subtle scroll indicator (animated chevron or arrow).

## Sticky Tab Navigation

A horizontal bar that stays fixed at the top when scrolling past the hero.

```css
.tab-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  gap: 0;
  background: var(--nav-bg);
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  padding: 1rem 2rem;
  cursor: pointer;
  border: none;
  background: transparent;
  font-weight: 600;
  transition: color 0.3s, border-bottom 0.3s;
}

.tab-btn.active {
  color: var(--accent);
  border-bottom: 3px solid var(--accent);
}
```

## Video Grid (Live Tab)

Responsive grid of YouTube video thumbnails with click-to-play.
Each card shows a YouTube thumbnail with a play button overlay.
Clicking replaces the thumbnail with an autoplaying iframe.

```css
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}

.video-card {
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-bg);
}

.video-thumb {
  cursor: pointer;
}

.video-thumb-img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.video-card iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
}

.video-card .video-info {
  padding: 0.75rem 1rem;
}
```

**Aspect ratio trick for older browsers:**
```css
.video-wrapper {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
}
.video-wrapper iframe {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}
```

## Timeline (Chronology Tab)

Vertical timeline with a central spine and alternating event cards.

```
        Left Card              |  Right Card
        ___________           _|_ ___________
       |           |         | o |           |
       |  Event A  |         |   |  Event B  |
       |___________|         |   |___________|
                              |
        ___________           |
       |           |         _|_
       |  Event C  |        | o |
       |___________|        |   |
                             |
```

**CSS structure:**
```css
.timeline {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 100%;
  background: var(--spine-color);
}

.timeline-item {
  display: flex;
  justify-content: flex-end; /* or flex-start for alternating */
  padding: 1rem 0;
  width: 50%;
}

.timeline-item:nth-child(odd) {
  align-self: flex-start;
  padding-right: 2rem;
}

.timeline-item:nth-child(even) {
  align-self: flex-end;
  margin-left: 50%;
  padding-left: 2rem;
}
```

**Mobile collapse:**
```css
@media (max-width: 768px) {
  .timeline::before { left: 20px; }
  .timeline-item,
  .timeline-item:nth-child(even) {
    width: 100%;
    margin-left: 0;
    padding-left: 3rem;
    padding-right: 1rem;
  }
}
```

## Category Badges

Color-coded labels on timeline events.

```css
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-album    { background: var(--color-album);    color: #fff; }
.badge-lineup   { background: var(--color-lineup);   color: #fff; }
.badge-milestone{ background: var(--color-milestone);color: #fff; }
.badge-other    { background: var(--color-other);    color: #fff; }
```

Suggested palette (dark themes):
- Album: `#00bcd4` (cyan)
- Lineup: `#e91e63` (pink)
- Milestone: `#ffc107` (amber)
- Other: `#9e9e9e` (gray)

## Member Portrait Chips

Small circular portraits used in lineup-change events.

```css
.member-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem;
}

.member-chip img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--accent);
}

.member-chip.departed img {
  opacity: 0.4;
  border-color: var(--muted);
}

.member-chip.joining img {
  border-color: var(--color-lineup);
  box-shadow: 0 0 6px var(--color-lineup);
}
```

## Member Cards (The Band Tab)

Full member sections with biography and images.

```css
.member-section {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  padding: 2rem;
  margin-bottom: 2rem;
}

.member-images {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.member-images img {
  width: 100%;
  border-radius: 8px;
  object-fit: cover;
}

@media (max-width: 768px) {
  .member-section {
    grid-template-columns: 1fr;
  }
}
```

## Album / Release Cards

Grid of album cards with cover art.

```css
.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.album-card {
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-bg);
  transition: transform 0.3s;
}

.album-card:hover {
  transform: translateY(-4px);
}

.album-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.album-card .album-info {
  padding: 0.75rem;
}
```

## Scroll Reveal Animation

Use Intersection Observer for fade-in-on-scroll effects.

```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

```css
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

## Image Fallback

Handle broken images gracefully with an inline fallback.

```html
<img src="assets/images/members/name.jpg"
     alt="Member Name"
     onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
<div class="img-fallback" style="display:none;">
  <span>MN</span>
</div>
```

```css
.img-fallback {
  display: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  background: var(--fallback-bg);
  color: var(--fallback-text);
  font-size: 1.5rem;
  font-weight: bold;
  border-radius: 8px;
}
```

## Trivia Footer

Fun facts displayed as cards in a horizontal strip.

```css
.trivia-strip {
  display: flex;
  gap: 1.5rem;
  padding: 2rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.trivia-card {
  flex: 0 0 280px;
  padding: 1.5rem;
  border-radius: 8px;
  background: var(--card-bg);
  scroll-snap-align: start;
}
```
