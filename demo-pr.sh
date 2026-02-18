#!/bin/bash
# Usage: ./demo-pr.sh [optional-suffix]
# Creates a PR from a saved patch for demo purposes.
# Run `git format-patch HEAD~1 -o /tmp/demo-patch/` first to save the patch.
SUFFIX="${1:-$(date +%s)}"
BRANCH="fix/spaces-in-filepath-${SUFFIX}"
BASE="main"

git checkout "$BASE"
git checkout -b "$BRANCH"
git am /tmp/demo-patch/*.patch
git push -u origin "$BRANCH"
gh pr create --title "fix: handle spaces in filepaths for JetBrains autocomplete" \
  --body "Fixes #10613" --base "$BASE"
