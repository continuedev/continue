# Releasing sw-continue

This document explains how to release the sw-continue CLI.

## Release Options

### Option 1: Manual Release via GitHub Actions (Recommended)

Trigger the "GitHub Release" workflow manually:

1. Go to **Actions** → **GitHub Release**
2. Click **Run workflow**
3. Enter:
   - **Version**: Semantic version (e.g., `1.0.0`, `1.0.0-beta.1`)
   - **Prerelease**: Check if this is a prerelease (alpha, beta, rc, etc.)
4. Click **Run workflow**

The workflow will:
- Build the CLI from the current commit
- Create a GitHub release
- Upload tarball and zip artifacts
- Output download URLs

**Download URLs** will follow this pattern:
```
https://github.com/skiller-whale/sw-continue/releases/download/v1.0.0/sw-continue-cli-1.0.0.tar.gz
https://github.com/skiller-whale/sw-continue/releases/download/v1.0.0/sw-continue-cli-1.0.0.zip
```

### Option 2: Tag-based Release

Push a git tag matching the version pattern:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The "Tagged Release" workflow will automatically:
- Detect the tag
- Build the CLI
- Create a GitHub release with artifacts
- Auto-detect prereleases (if tag contains `alpha`, `beta`, `rc`, etc.)

## Using the Released CLI

### From Tarball
```bash
curl -L https://github.com/skiller-whale/sw-continue/releases/download/v1.0.0/sw-continue-cli-1.0.0.tar.gz | tar xz
./dist/cn.js --help
```

### From Zip
```bash
# Download and extract
curl -L https://github.com/skiller-whale/sw-continue/releases/download/v1.0.0/sw-continue-cli-1.0.0.zip -o cli.zip
unzip cli.zip
./dist/cn.js --help
```

### Add to PATH
```bash
# Extract to a location in your PATH
tar xz -C /usr/local/bin --strip-components=1 -f sw-continue-cli-1.0.0.tar.gz
cn --help
```

## Version Format

Use semantic versioning:
- **Stable**: `1.0.0`, `1.2.3`
- **Beta**: `1.0.0-beta.1`, `1.0.0-beta.2`
- **Alpha**: `1.0.0-alpha.1`
- **Release Candidate**: `1.0.0-rc.1`

## Current Workflows

### `github-release.yml`
- **Trigger**: Manual via GitHub Actions UI
- **Inputs**: Version number, prerelease flag
- **Output**: GitHub release with tarball and zip

### `tagged-release.yml`
- **Trigger**: Push any tag matching `v[0-9]+.[0-9]+.[0-9]+*`
- **Output**: Automatic GitHub release with artifacts
- **Prerelease Detection**: Automatic (checks if tag contains alpha/beta/rc/pre)

## Removed Workflows

The original Continue workflows (`auto-release.yml`, `beta-release.yml`, `stable-release.yml`) were designed for npm publishing. These have been replaced with simple GitHub-based releases.

If you need npm publishing in the future, those can be re-enabled or updated.
