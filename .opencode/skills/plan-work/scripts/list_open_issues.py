#!/usr/bin/env python3
"""Fetch open GitHub issues for cescofry/Bander and print them grouped by label.

Usage:
    python3 list_open_issues.py [--repo OWNER/REPO] [--json]

Requires the `gh` CLI to be installed and authenticated.

Exit codes:
    0  Success (issues printed)
    1  gh CLI missing or authentication failure
    2  No open issues found
"""

import json
import subprocess
import sys
import argparse

REPO = "cescofry/Bander"


def run_gh(repo: str) -> list[dict]:
    """Call `gh issue list` and return parsed JSON."""
    try:
        result = subprocess.run(
            [
                "gh", "issue", "list",
                "--repo", repo,
                "--state", "open",
                "--limit", "200",
                "--json", "number,title,body,labels,url",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        print("ERROR: `gh` CLI not found. Install it: https://cli.github.com/", file=sys.stderr)
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print("ERROR: `gh` timed out.", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print(f"ERROR: `gh` failed (exit {result.returncode}):\n{result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

    return json.loads(result.stdout)


def group_by_label(issues: list[dict]) -> dict[str, list[dict]]:
    """Group issues by their first label. Unlabeled issues go under 'unlabeled'."""
    groups: dict[str, list[dict]] = {}
    for issue in issues:
        labels = [lbl["name"] for lbl in issue.get("labels", [])]
        key = labels[0] if labels else "unlabeled"
        groups.setdefault(key, []).append(issue)

    # Sort: recognized labels first, then alphabetical, then unlabeled last
    recognized = ["band", "band-request"]
    sorted_groups: dict[str, list[dict]] = {}
    for label in recognized:
        if label in groups:
            sorted_groups[label] = groups.pop(label)
    for label in sorted(groups.keys()):
        if label != "unlabeled":
            sorted_groups[label] = groups[label]
    if "unlabeled" in groups:
        sorted_groups["unlabeled"] = groups["unlabeled"]

    return sorted_groups


def print_grouped(groups: dict[str, list[dict]]) -> None:
    """Pretty-print grouped issues for terminal display."""
    for label, issues in groups.items():
        print(f"\n[{label}]")
        for issue in issues:
            all_labels = ", ".join(lbl["name"] for lbl in issue.get("labels", []))
            label_suffix = f"  ({all_labels})" if all_labels else ""
            print(f"  #{issue['number']:>4}  {issue['title']}{label_suffix}")


def main():
    parser = argparse.ArgumentParser(description="List open GitHub issues grouped by label.")
    parser.add_argument("--repo", default=REPO, help=f"GitHub repo (default: {REPO})")
    parser.add_argument("--json", dest="as_json", action="store_true", help="Output raw JSON instead of formatted text")
    args = parser.parse_args()

    issues = run_gh(args.repo)

    if not issues:
        print("No open issues found.", file=sys.stderr)
        sys.exit(2)

    if args.as_json:
        groups = group_by_label(issues)
        print(json.dumps(groups, indent=2))
    else:
        groups = group_by_label(issues)
        print_grouped(groups)
        print(f"\n{len(issues)} open issue(s) total.")


if __name__ == "__main__":
    main()
