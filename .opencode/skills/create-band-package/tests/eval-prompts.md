# Eval Prompts

Prompts for testing that the `create-band-package` skill triggers correctly
and produces the expected output.

## Should Trigger

These prompts should activate the `create-band-package` skill.

1. "Create a band package for The Beatles"
2. "Research Led Zeppelin and add it to Bander"
3. "Add a band -- Radiohead"
4. "Create a musician archive for David Bowie"
5. "Research Nirvana for the band site"
6. "Build a music research package for Queen"
7. "Add The Rolling Stones to Bander"
8. "Research Jimi Hendrix for the band platform"
9. "I want to add Fleetwood Mac with videos and timeline data"
10. "Create a data package for Metallica"

## Should NOT Trigger

These prompts should NOT activate the `create-band-package` skill.
They should route to other skills or general handling instead.

1. "Create a documentation page about our API" (-> page-publisher)
2. "Research whether this startup idea is viable" (-> idea-research)
3. "Build a landing page for my product" (-> general coding)
4. "Create a blog about cooking" (-> general coding)
5. "Make a portfolio website" (-> general coding)

## Expected Output Contract

When triggered, the skill should produce:

- [ ] A folder under `bands/<slug>/` with `band.json`
- [ ] Split data files: `members.json`, `events.json`, `videos.json`, `albums.json`
- [ ] `theme.json` with visual customization tokens
- [ ] Localized images in `assets/images/`
- [ ] At least 3 members, 5 events, 6 videos
- [ ] All YouTube URLs are valid
- [ ] All image references point to local files
- [ ] `band.json` slug matches the folder name
