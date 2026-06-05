#!/usr/bin/env python3
"""Validate a band package against the Bander data contract.

Checks for required files, valid JSON, schema conformance, image
references, and minimum content thresholds.

Usage:
    python3 validate_band_package.py <band-folder>
    python3 validate_band_package.py bands/pantera

Exit code 0 = all checks pass.
Exit code 1 = one or more checks failed.
"""

import json
import os
import re
import sys
from pathlib import Path


class BandChecker:
    def __init__(self, band_dir: str):
        self.band_dir = Path(band_dir)
        self.results: list[tuple[str, bool, str]] = []
        self.band_data: dict = {}
        self.members: list = []
        self.events: list = []
        self.videos: list = []
        self.albums: list = []

    def check(self, name: str, passed: bool, detail: str = ""):
        self.results.append((name, passed, detail))

    # ------------------------------------------------------------------
    # Load helpers
    # ------------------------------------------------------------------

    def _load_json(self, filename: str) -> tuple:
        """Load a JSON file from the band dir. Returns (data, error_msg)."""
        path = self.band_dir / filename
        if not path.exists():
            return None, f"{filename} not found"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data, None
        except json.JSONDecodeError as e:
            return None, f"{filename} is not valid JSON: {e}"

    # ------------------------------------------------------------------
    # Checks
    # ------------------------------------------------------------------

    def check_band_json(self):
        data, err = self._load_json("band.json")
        if err:
            self.check("band.json exists and is valid", False, err)
            return False
        self.band_data = data
        self.check("band.json exists and is valid", True, "OK")

        # Required fields
        for field in ["name", "slug"]:
            val = data.get(field)
            self.check(f"band.json has '{field}'", bool(val),
                       f"'{field}': {val}" if val else f"MISSING '{field}'")

        # Recommended fields
        for field in ["formed", "origin", "genres", "description"]:
            val = data.get(field)
            has = bool(val) if not isinstance(val, list) else len(val) > 0
            self.check(f"band.json has '{field}'", has,
                       "Present" if has else f"MISSING (recommended)")

        # Slug matches folder name
        slug = data.get("slug", "")
        folder = self.band_dir.name
        self.check("slug matches folder name", slug == folder,
                   f"slug='{slug}', folder='{folder}'"
                   if slug != folder else f"'{slug}' OK")

        # Trivia
        trivia = data.get("trivia", [])
        self.check("band.json has trivia", len(trivia) >= 3,
                   f"{len(trivia)} trivia items")
        return True

    def check_members(self):
        data, err = self._load_json("members.json")
        if err:
            self.check("members.json exists", False, err)
            return
        self.members = data if isinstance(data, list) else []
        self.check("members.json exists", True, f"{len(self.members)} members")
        self.check("At least 3 members", len(self.members) >= 3,
                   f"{len(self.members)} found")

        for m in self.members:
            name = m.get("name", "?")
            self.check(f"Member '{name}' has role", bool(m.get("role")),
                       m.get("role", "MISSING"))

    def check_events(self):
        data, err = self._load_json("events.json")
        if err:
            self.check("events.json exists", False, err)
            return
        self.events = data if isinstance(data, list) else []
        self.check("events.json exists", True, f"{len(self.events)} events")
        self.check("At least 5 events", len(self.events) >= 5,
                   f"{len(self.events)} found")

        categories = set()
        for e in self.events:
            cat = e.get("category", "")
            if cat:
                categories.add(cat)
        self.check("Events use multiple categories", len(categories) >= 2,
                   f"Categories: {', '.join(sorted(categories))}")

    def check_videos(self):
        data, err = self._load_json("videos.json")
        if err:
            self.check("videos.json exists", False, err)
            return
        self.videos = data if isinstance(data, list) else []
        self.check("videos.json exists", True, f"{len(self.videos)} videos")
        self.check("At least 6 videos", len(self.videos) >= 6,
                   f"{len(self.videos)} found")

        # Check YouTube URLs
        bad_urls = []
        for v in self.videos:
            url = v.get("youtube_url", "")
            if not re.match(r'https?://(www\.)?(youtube\.com|youtu\.be)/', url):
                bad_urls.append(v.get("title", "?"))
        self.check("All video URLs are valid YouTube", len(bad_urls) == 0,
                   f"Bad URLs: {', '.join(bad_urls)}" if bad_urls else "All valid")

    def check_albums(self):
        data, err = self._load_json("albums.json")
        if err:
            self.check("albums.json exists", False, err)
            return
        self.albums = data if isinstance(data, list) else []
        self.check("albums.json exists", True, f"{len(self.albums)} albums")

    def check_theme(self):
        data, err = self._load_json("theme.json")
        if err:
            self.check("theme.json exists", False, err)
            return
        self.check("theme.json exists", True, "OK")
        self.check("theme.json has colors", bool(data.get("colors")),
                   "Present" if data.get("colors") else "MISSING")
        self.check("theme.json has fonts", bool(data.get("fonts")),
                   "Present" if data.get("fonts") else "MISSING")

    def check_images_dir(self):
        images_dir = self.band_dir / "assets" / "images"
        has_dir = images_dir.is_dir()
        if has_dir:
            count = sum(1 for _ in images_dir.rglob("*") if _.is_file())
        else:
            count = 0
        self.check("assets/images/ exists and has files", count > 0,
                   f"{count} image files" if count else "MISSING or EMPTY")

    def check_image_references(self):
        """Check that image paths referenced in JSON actually exist."""
        missing = []

        for m in self.members:
            for img in m.get("images", []):
                if img and not (self.band_dir / img).exists():
                    missing.append(img)

        for e in self.events:
            img = e.get("image")
            if img and not (self.band_dir / img).exists():
                missing.append(img)

        for a in self.albums:
            img = a.get("cover_image")
            if img and not (self.band_dir / img).exists():
                missing.append(img)

        self.check("All referenced images exist locally",
                   len(missing) == 0,
                   f"{len(missing)} missing: {', '.join(missing[:5])}"
                   if missing else "All present")

    # ------------------------------------------------------------------
    # Run
    # ------------------------------------------------------------------

    def run(self) -> bool:
        if not self.band_dir.is_dir():
            print(f"ERROR: {self.band_dir} is not a directory.", file=sys.stderr)
            return False

        if not self.check_band_json():
            self.report()
            return False

        self.check_members()
        self.check_events()
        self.check_videos()
        self.check_albums()
        self.check_theme()
        self.check_images_dir()
        self.check_image_references()

        self.report()
        return all(passed for _, passed, _ in self.results)

    def report(self):
        print(f"\n{'=' * 60}")
        print(f"  Band Package Validation: {self.band_dir}")
        print(f"{'=' * 60}\n")

        passed = 0
        failed = 0
        for name, ok, detail in self.results:
            status = "PASS" if ok else "FAIL"
            print(f"  [{status}] {name}")
            if detail:
                print(f"         {detail}")
            if ok:
                passed += 1
            else:
                failed += 1

        print(f"\n{'─' * 60}")
        print(f"  Total: {passed + failed}  |  Passed: {passed}  |  Failed: {failed}")
        if failed == 0:
            print("  Result: ALL CHECKS PASSED")
        else:
            print(f"  Result: {failed} CHECK(S) FAILED")
        print(f"{'─' * 60}\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 validate_band_package.py <band-folder>",
              file=sys.stderr)
        sys.exit(1)

    band_dir = sys.argv[1]
    checker = BandChecker(band_dir)
    success = checker.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
