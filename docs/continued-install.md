# Installing Continued

Continued is an unofficial, community-maintained fork of the Continue VS Code extension. It is **not** published to the VS Code Marketplace or Open VSX. You install it from a `.vsix` file attached to each [GitHub release](https://github.com/b1tninja/continued/releases).

Continued is not affiliated with Continue Dev, Inc.

**Requirements:** VS Code 1.105 or newer (or a VS Code-based editor built on it). Older versions cannot load the extension and will refuse to install it, so they keep the previously installed version.

The current release is [Continued 2.2.0](https://github.com/b1tninja/continued/releases/tag/v2.2.0-vscode).

## Option 1: install the latest release

### 1. Download the `.vsix` for your platform

Open the [latest release](https://github.com/b1tninja/continued/releases/latest) and download the file for your platform, plus `SHA256SUMS.txt`:

| Platform              | File                                    |
| --------------------- | --------------------------------------- |
| Windows x64           | `continued-win32-x64-<version>.vsix`    |
| Windows Arm64         | `continued-win32-arm64-<version>.vsix`  |
| macOS (Apple Silicon) | `continued-darwin-arm64-<version>.vsix` |
| macOS (Intel)         | `continued-darwin-x64-<version>.vsix`   |
| Linux x64             | `continued-linux-x64-<version>.vsix`    |
| Linux Arm64           | `continued-linux-arm64-<version>.vsix`  |

For 2.2.0, the Windows x64 file is `continued-win32-x64-2.2.0.vsix`. The 2.2.0 release also has `linux-armhf` and `alpine-x64` files: don't use them, because their native modules are built for other platforms. There are no 32-bit ARM or Alpine (musl) builds.

With the [GitHub CLI](https://cli.github.com/), you can download the latest release's file and checksums in one command. Change `win32-x64` to your platform:

```bash
gh release download --repo b1tninja/continued --pattern "continued-win32-x64-*.vsix" --pattern SHA256SUMS.txt --dir continued-vsix
```

### 2. Verify the download (optional, recommended)

The packages are not code-signed, so the checksum is how you confirm you have the file the release published. In the folder that holds the `.vsix` and `SHA256SUMS.txt`:

```powershell
# Windows PowerShell: prints True when the checksum matches
$file = Get-ChildItem continued-win32-x64-*.vsix
$expected = (Select-String -Path SHA256SUMS.txt -SimpleMatch $file.Name).Line.Split(' ')[0]
(Get-FileHash $file.FullName -Algorithm SHA256).Hash -eq $expected
```

```bash
# Linux: prints "<file>: OK" when the checksum matches
sha256sum --check --ignore-missing SHA256SUMS.txt
# macOS (change darwin-arm64 to darwin-x64 on an Intel Mac)
grep continued-darwin-arm64 SHA256SUMS.txt | shasum -a 256 --check
```

### 3. Install it

```bash
code --install-extension continued-win32-x64-2.2.0.vsix --force
```

Or in VS Code: open the **Extensions** view, select **...** → **Install from VSIX...**, and choose the file.

### 4. Reload VS Code

Run **Developer: Reload Window**, then open the Continued icon in the activity bar.

Continued uses the extension ID `b1tninja.continued`. It installs alongside the original Continue extension (`Continue.continue`) without conflicts, so you do not need to uninstall Continue first. It reads your existing `~/.continue` configuration.

To check which version is installed, run `code --list-extensions --show-versions` and look for `b1tninja.continued@<version>`.

> Release files are named with the version only, for example `continued-win32-x64-2.2.0.vsix`. GitHub Actions builds (Option 2) add the short commit SHA, for example `continued-win32-x64-2.2.0-62505d0.vsix`.

## Option 2: download an unreleased build from GitHub Actions

Fixes land on `main` before they are released. To try them, install a build from GitHub Actions. Builds are created on request, so you may need to trigger one:

1. Open **Actions** → **PR Build And Upload VSIX** on `b1tninja/continued`.
2. Select **Run workflow**, choose `main`, and run it.
3. When the run finishes, open it and download the artifact for your platform: `win32-x64-vsix`, `linux-x64-vsix` or `darwin-arm64-vsix`.
4. Unzip the artifact and install the `.vsix` as in Option 1.

You need to be signed in to GitHub with access to the repository to download artifacts. Artifacts expire after the retention period set for the repository. Actions builds have no `SHA256SUMS.txt`.

With the GitHub CLI you can download the latest Windows build in one command:

```powershell
gh run download --repo b1tninja/continued --name win32-x64-vsix --dir "$env:TEMP\continued-vsix"
code --install-extension (Get-ChildItem "$env:TEMP\continued-vsix" -Filter *.vsix | Select-Object -First 1).FullName --force
```

Replace `win32-x64-vsix` with `darwin-arm64-vsix` on a Mac and use `bash`/`zsh` syntax with `gh run download ... --dir "$TMPDIR/continued-vsix"`.

## Updating

VS Code does not update side-loaded `.vsix` files automatically. To hear about new releases, select **Watch** → **Custom** → **Releases** on the [repository](https://github.com/b1tninja/continued).

To update, download the new release's `.vsix` and run the install command again with `--force`. Your settings and `~/.continue` configuration are kept.

To go back to an earlier version, install that release's `.vsix` the same way. Older releases are on the [releases page](https://github.com/b1tninja/continued/releases).

## Troubleshooting

| Symptom                                           | Fix                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `code` is not recognised                          | In VS Code run **Shell Command: Install 'code' command in PATH**, then open a new terminal.          |
| Install fails with "Extension ... is not a valid" | The download is incomplete. Re-download and compare the SHA-256 checksum.                            |
| Install says the extension is not compatible      | Your VS Code is older than 1.105. Update VS Code, then install again.                                |
| The Continued icon does not appear                | Reload the window, then check **View → Appearance** for the activity bar setting.                    |
| Models do not load                                | Check your provider credentials and use **Test connection** or the refresh icon in the model picker. |
| A corporate proxy blocks GitHub downloads         | Download the `.vsix` on another machine and copy it over.                                            |

## Building from source

```bash
git clone https://github.com/b1tninja/continued.git
cd continued
node ./scripts/build-packages.js
cd gui && npm ci && npm run build && cd ..
cd extensions/vscode && npm ci && npm run prepackage && npm run package
npx @vscode/vsce package --no-dependencies
```

Node.js 20.20.1 or later is required (see `.nvmrc`). Building on Windows also needs the Visual Studio Build Tools for native modules.
