---
name: Update docs from GitHub PR
description: Provide a PR link to update docs based on
alwaysApply: false
---

When provided with a GitHub PR URL, use the GitHub CLI (`gh pr view <PR_URL> --json title,body,commits,files,additions,deletions,changedFiles`) to fetch comprehensive PR details including title, description, commits, changed files, and diff statistics. Analyze the PR content to identify what documentation in the `docs` folder needs to be updated, created, or modified. Update relevant documentation files to reflect the changes, new features, bug fixes, or improvements described in the PR. Ensure documentation changes are accurate, well-structured, and maintain consistency with existing docs formatting and style.
