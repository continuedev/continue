---
name: Setup Scripts
description: Update Setup Scripts if needed
---

If there are any changes in this pull request that would require changes to any setup scripts in this repository, please make the requisite updates. This would include things like new package management systems, new moving parts of the build process, or an updated local development environment. If the PR only includes "content" (docs, source code, etc.) changes, then you can basically immediately disqualify it as not requiring updates to setup scripts.

The most relevant setup scripts (all in the scripts/ folder) are:

- `install-dependencies.sh` and `install-dependencies.ps1`, both of which are intended to take a user from a fresh clone to a fully set up development environment
- `build-packages.js`, which builds everything in the `packages` folder
