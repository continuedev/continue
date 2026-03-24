---
name: Dependency Security Review
description: Review dependency changes for security implications and breaking changes
---

# Dependency Security Review

Review this pull request for changes to dependencies. A significant portion of PRs in this repo are automated dependency bumps (Dependabot, Snyk). This check ensures dependency changes get meaningful review.

## What to Check

### For Any `package.json` Changes

1. **New dependencies** - For each newly added dependency:

   - Is it well-maintained (not abandoned)?
   - Does it have known vulnerabilities?
   - Is it the right choice, or does an existing dependency already cover this use case?
   - Is the version pinned appropriately (exact vs range)?

2. **Major version bumps** - For major version upgrades:

   - Are there breaking changes that affect our usage?
   - Have the callers been updated to match the new API?

3. **Removed dependencies** - For each removed dependency:
   - Are all imports/requires of this dependency also removed?
   - Is there a replacement, or was the functionality dropped?

### For `package-lock.json` Changes

1. **Large lockfile diffs** (>500 lines changed) - Flag for human review, as they may indicate a transitive dependency shift that warrants attention.

2. **New transitive dependencies** - Check if the total dependency count increased significantly.

### Security-Specific Concerns

1. **Packages with filesystem/network access** - New dependencies that read/write files or make network requests deserve extra scrutiny since this tool runs locally on user machines.

2. **Native/binary dependencies** - New native modules (`node-gyp`, `.node` binaries) increase the attack surface and build complexity.

3. **Post-install scripts** - Dependencies with `postinstall` scripts can execute arbitrary code during `npm install`.

## What to Do

- If you find concerning dependency changes, add a comment explaining the concern.
- Do NOT modify `package.json` or `package-lock.json` files directly.
- If no dependency files were changed in this PR, do nothing.
