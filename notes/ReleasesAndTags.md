# Releases and Tags

## Two version tracks

The repository maintains two parallel VS Code release tracks, distinguished by the minor version number:

| Track       | Version series               | GitHub release type   |
| ----------- | ---------------------------- | --------------------- |
| Pre-release | `v1.3.x-vscode` (odd minor)  | marked `--prerelease` |
| Stable      | `v1.2.x-vscode` (even minor) | normal release        |

The tag format is structurally identical for both — the channel is encoded entirely in the minor version number.

## Why odd/even minor?

The VS Code Marketplace has a built-in pre-release channel. Microsoft's convention: an extension with an **odd minor version** (1.1.x, 1.3.x, 1.5.x…) is routed to the pre-release channel; an **even minor version** (1.0.x, 1.2.x, 1.4.x…) goes to the stable channel. Users who opt into pre-releases on the extension page get the odd-minor builds automatically; everyone else gets the even-minor builds.

## Why have pre-releases at all?

The two tracks serve different cadences and audiences:

- **Pre-releases** ship multiple times a week (sometimes daily), directly from `main`. They go to power users and early adopters who opted in.
- **Stable releases** are infrequent snapshots — essentially a pre-release commit that has been validated by weeks of real-world pre-release usage.

This gives two benefits:

1. **Risk containment**: regressions in a pre-release only affect users who opted in. By the time a stable release is cut, those regressions have been found and fixed.
2. **Fast iteration without breaking the majority**: the pre-release user base acts as a live QA pool, so the larger stable audience gets a more reliable build.

## Workflow files

- `.github/workflows/vscode-prerelease.yml` — creates the `1.3.x` pre-release series; auto-increments patch, creates a version-bump PR against `main`, then tags and publishes with `--prerelease`.
- `.github/workflows/vscode-version-bump.yml` — (mostly dormant) shows the stable promotion pattern: takes the latest odd-minor tag and creates a new even-minor branch/release from it.
- `.github/workflows/stable-release.yml` — handles stable releases for the **CLI** (`cn` binary), not the VS Code extension.
