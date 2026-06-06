#!/usr/bin/env python3
"""Transform a GitHub issue into a ready-to-use prompt for opencode.

Usage:
    python3 prepare_issue_prompt.py <issue-number> [--repo OWNER/REPO]

Fetches the issue via `gh`, detects known labels, applies label-specific
formatting, and prints the final prompt to stdout.

Label handlers:
    band / band-request  -->  Prepend create-band-package skill reference.
    (unknown)            -->  Pass through unchanged with metadata footer.

Exit codes:
    0  Success
    1  gh CLI error or issue not found
"""

import json
import subprocess
import sys
import argparse

REPO = "cescofry/Bander"

# Labels that trigger the band-package skill prefix
BAND_LABELS = {"band", "band-request"}


def fetch_issue(repo: str, number: int) -> dict:
    """Fetch a single issue by number."""
    try:
        result = subprocess.run(
            [
                "gh", "issue", "view", str(number),
                "--repo", repo,
                "--json", "number,title,body,labels,url",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        print("ERROR: `gh` CLI not found.", file=sys.stderr)
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print("ERROR: `gh` timed out.", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print(f"ERROR: Could not fetch issue #{number}:\n{result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

    return json.loads(result.stdout)


def has_band_label(issue: dict) -> bool:
    """Check if the issue carries a band-related label."""
    labels = {lbl["name"] for lbl in issue.get("labels", [])}
    return bool(labels & BAND_LABELS)


def format_band_prompt(issue: dict) -> str:
    """Format a band-labeled issue into a create-band-package prompt."""
    labels_str = ", ".join(lbl["name"] for lbl in issue.get("labels", []))
    body = (issue.get("body") or "").strip()

    lines = [
        "Use the @.opencode/skills/create-band-package/SKILL.md to create the following band:",
        "",
        f"GitHub issue: #{issue['number']} {issue['title']}",
        f"URL: {issue['url']}",
        "",
        body,
        "",
        f"GitHub labels: {labels_str}",
    ]
    return "\n".join(lines)


def format_generic_prompt(issue: dict) -> str:
    """Format an issue with unknown labels as a pass-through prompt."""
    labels_str = ", ".join(lbl["name"] for lbl in issue.get("labels", []))
    body = (issue.get("body") or "").strip()

    lines = [
        f"GitHub issue: #{issue['number']} {issue['title']}",
        f"URL: {issue['url']}",
        "",
        body,
        "",
        f"GitHub labels: {labels_str}",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Prepare a GitHub issue as an opencode prompt.")
    parser.add_argument("number", type=int, help="GitHub issue number")
    parser.add_argument("--repo", default=REPO, help=f"GitHub repo (default: {REPO})")
    args = parser.parse_args()

    issue = fetch_issue(args.repo, args.number)

    if has_band_label(issue):
        prompt = format_band_prompt(issue)
    else:
        prompt = format_generic_prompt(issue)

    print(prompt)


if __name__ == "__main__":
    main()
