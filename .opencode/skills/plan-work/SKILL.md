---
name: plan-work
description: >-
  Fetch open GitHub issues for the Bander project, let the user pick one,
  and execute it in the current session.
  Use when the user says "plan work", "what should we work on",
  "pick an issue", "process GitHub issues", "work on an issue",
  "plan next steps", "organize work", or "what issues are open".
  For creating a band package directly (without an issue) use
  create-band-package instead.
---

# Plan Work

Read open GitHub issues from the Bander repository, present them
grouped by label, let the user select one, transform it into a
working prompt, and continue processing in the current session.
After the work is complete, offer to create a PR linked to the issue.

## Prerequisites

- The `gh` CLI must be installed and authenticated (`gh auth status`).
- The repository is `cescofry/Bander`.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| **Repository** | No | Defaults to `cescofry/Bander`. |

## Workflow

Follow these steps in order. Mark each step in your todo list.

### Step 1 -- Fetch Open Issues

Run the listing script:

```bash
python3 <skill_dir>/scripts/list_open_issues.py
```

This prints all open issues grouped by label. If exit code is 2,
there are no open issues -- tell the user and stop.

If exit code is 1, the `gh` CLI is missing or not authenticated.
Tell the user to run `gh auth login` and try again.

### Step 2 -- Present Issues to the User

Show the grouped list from Step 1 to the user. Use the Question
tool to let them pick one issue by number. Present options grouped
by label section, with each option showing `#<number> <title>`.

Example display:

```
[band]
  #1  Band request: Sepultura  (band)

[bug]
  #5  Timeline renders wrong on mobile  (bug)

[unlabeled]
  #7  Improve README examples
```

Ask the user to select one issue to work on.

### Step 3 -- Prepare the Prompt

Run the prompt preparation script with the selected issue number:

```bash
python3 <skill_dir>/scripts/prepare_issue_prompt.py <issue-number>
```

This fetches the full issue and transforms it based on its labels.

#### Label-specific formatting

| Label | Behavior |
|-------|----------|
| `band` or `band-request` | Prepend `Use the @.opencode/skills/create-band-package/SKILL.md to create the following band:` before the issue body. |
| Any other label | Pass the issue body through unchanged with a metadata header and footer. |

The script always appends a `GitHub labels: ...` footer line.

### Step 4 -- Execute the Prepared Prompt

Take the output from Step 3 and execute it as the next task in the
current session. This means: read the prepared prompt text and
follow the instructions it contains.

- For `band` / `band-request` issues, this will trigger the
  `create-band-package` skill automatically via the `@` reference.
- For other issues, follow the issue description as instructions.

Do the work described in the prompt. If you need clarification from
the user, ask -- the current session supports follow-up questions.

### Step 5 -- Create a PR

After the work is complete, ask the user:

> Create a PR for GitHub issue #N "<title>" and link it so the issue closes on merge?

Use the Question tool with Yes / No options.

If **Yes**:

1. Write a short summary of the work that was done (what changed,
   files/features touched, tests run if any).
2. Create a PR whose body contains the summary followed by
   `Closes #<issue-number>` so the issue closes automatically when
   the PR merges.

```bash
gh pr create --repo cescofry/Bander \
  --title "<concise PR title>" \
  --body "<summary>

Closes #<issue-number>"
```

3. Report the created PR URL to the user.

If **No**, tell the user no PR was created and the issue remains open.

## Error Recovery

| Failure | Detection | Fix |
|---------|-----------|-----|
| `gh` CLI not found | `list_open_issues.py` exits with code 1 | Tell the user to install `gh`: https://cli.github.com/ |
| `gh` not authenticated | `gh` returns auth error | Tell the user to run `gh auth login`. |
| No open issues | `list_open_issues.py` exits with code 2 | Tell the user there is nothing to work on. |
| Issue fetch fails | `prepare_issue_prompt.py` exits with code 1 | Report the error. Ask the user to check the issue number. |
| Issue has no body | Body is empty after fetch | Use the issue title as the task description. |
| PR create fails | `gh pr create` returns non-zero | Report the error. The user can create the PR manually. |

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | This specification. |
| `scripts/list_open_issues.py` | Fetches and groups open issues by label. |
| `scripts/prepare_issue_prompt.py` | Transforms an issue into a label-aware prompt. |
