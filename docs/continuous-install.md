# Installing Continuous

Continuous is an unofficial, community-maintained fork of the Continue VS Code extension. It is **not** published to the VS Code Marketplace or Open VSX. You install it from a `.vsix` file attached to each [GitHub release](https://github.com/b1tninja/continuous/releases).

Continuous is not affiliated with Continue Dev, Inc.

**Requirements:** VS Code 1.105 or newer (or a VS Code-based editor built on it). Older versions cannot load the extension and will refuse to install it, so they keep the previously installed version.

The current release is [Continuous 2.4.4](https://github.com/b1tninja/continuous/releases/tag/v2.4.4-vscode).

## Option 1: install the latest release

### 1. Download the `.vsix` for your platform

Open the [latest release](https://github.com/b1tninja/continuous/releases/latest) and download the file for your platform, plus `SHA256SUMS.txt`:

| Platform              | File                                     |
| --------------------- | ---------------------------------------- |
| Windows x64           | `continuous-win32-x64-<version>.vsix`    |
| Windows Arm64         | `continuous-win32-arm64-<version>.vsix`  |
| macOS (Apple Silicon) | `continuous-darwin-arm64-<version>.vsix` |
| macOS (Intel)         | `continuous-darwin-x64-<version>.vsix`   |
| Linux x64             | `continuous-linux-x64-<version>.vsix`    |
| Linux Arm64           | `continuous-linux-arm64-<version>.vsix`  |

For 2.4.4, the Windows x64 file is `continuous-win32-x64-2.4.4.vsix`. There are no 32-bit ARM or Alpine (musl) builds; the 2.2.0 release's `linux-armhf` and `alpine-x64` files did not work, because their native modules were built for other platforms.

With the [GitHub CLI](https://cli.github.com/), you can download the latest release's file and checksums in one command. Change `win32-x64` to your platform:

```bash
gh release download --repo b1tninja/continuous --pattern "continuous-win32-x64-*.vsix" --pattern SHA256SUMS.txt --dir continuous-vsix
```

### 2. Verify the download (optional, recommended)

The packages are not code-signed, so the checksum is how you confirm you have the file the release published. In the folder that holds the `.vsix` and `SHA256SUMS.txt`:

```powershell
# Windows PowerShell: prints True when the checksum matches
$file = Get-ChildItem continuous-win32-x64-*.vsix
$expected = (Select-String -Path SHA256SUMS.txt -SimpleMatch $file.Name).Line.Split(' ')[0]
(Get-FileHash $file.FullName -Algorithm SHA256).Hash -eq $expected
```

```bash
# Linux: prints "<file>: OK" when the checksum matches
sha256sum --check --ignore-missing SHA256SUMS.txt
# macOS (change darwin-arm64 to darwin-x64 on an Intel Mac)
grep continuous-darwin-arm64 SHA256SUMS.txt | shasum -a 256 --check
```

### 3. Install it

```bash
code --install-extension continuous-win32-x64-2.4.4.vsix --force
```

Or in VS Code: open the **Extensions** view, select **...** → **Install from VSIX...**, and choose the file.

### 4. Reload VS Code

Run **Developer: Reload Window**, then open the Continuous icon in the activity bar.

Continuous uses the extension ID `b1tninja.continuous`. It installs alongside the original Continue extension (`Continue.continue`) without conflicts, so you do not need to uninstall Continue first. It reads your existing `~/.continue` configuration.

To check which version is installed, run `code --list-extensions --show-versions` and look for `b1tninja.continuous@<version>`.

**Coming from 2.4.1 or earlier?** Those releases used the ID `b1tninja.continued`, which is taken on the VS Code Marketplace by another extension, so from 2.4.2 the ID is `b1tninja.continuous`. VS Code treats it as a different extension: uninstall `b1tninja.continued` (`code --uninstall-extension b1tninja.continued`) after installing 2.4.2, so the two do not both run. Your settings and configuration carry over: the first start copies `~/.continue` to `~/.continuous` (the codebase index is rebuilt) and each `continue.*` setting to its `continuous.*` name, and a workspace's `.continue` folder is still read. Keyboard shortcuts bound to a `continue.*` command need the new `continuous.*` name. API keys kept in VS Code's secure storage do not carry over, as each extension has its own: enter them again, or keep them in `~/.continuous/.env`. The welcome screen also shows once; close it, your models are already set up.

> Release files are named with the version only, for example `continuous-win32-x64-2.4.4.vsix`. GitHub Actions builds (Option 2) add the short commit SHA, for example `continuous-win32-x64-2.4.4-g62505d0.vsix`.

## Option 2: download an unreleased build from GitHub Actions

Fixes land on `main` before they are released. To try them, install a build from GitHub Actions. Builds are created on request, so you may need to trigger one:

1. Open **Actions** → **PR Build And Upload VSIX** on `b1tninja/continuous`.
2. Select **Run workflow**, choose `main`, and run it.
3. When the run finishes, open it and download the artifact for your platform: `win32-x64-vsix`, `linux-x64-vsix` or `darwin-arm64-vsix`.
4. Unzip the artifact and install the `.vsix` as in Option 1.

You need to be signed in to GitHub with access to the repository to download artifacts. Artifacts expire after the retention period set for the repository. Actions builds have no `SHA256SUMS.txt`.

With the GitHub CLI you can download the latest Windows build in one command:

```powershell
gh run download --repo b1tninja/continuous --name win32-x64-vsix --dir "$env:TEMP\continuous-vsix"
code --install-extension (Get-ChildItem "$env:TEMP\continuous-vsix" -Filter *.vsix | Select-Object -First 1).FullName --force
```

Replace `win32-x64-vsix` with `darwin-arm64-vsix` on a Mac and use `bash`/`zsh` syntax with `gh run download ... --dir "$TMPDIR/continuous-vsix"`.

## The terminal CLI

Releases from 2.4.3 on also carry the command-line agent, `continuous-cli-<version>.tgz`. It needs Node.js 22 or newer and installs with npm straight from the release, with nothing else to download:

```bash
npm i -g https://github.com/b1tninja/continuous/releases/download/v2.4.4-vscode/continuous-cli-2.4.4.tgz
```

The command is `continuous` (upstream's is `cn`, so both can be installed). It uses the same `~/.continuous` folder as the extension, and `continuous --config <path to a .yaml>` runs with one config file. To update, install the next release's `.tgz` the same way; the CLI does not update itself.

## Updating

VS Code does not update side-loaded `.vsix` files automatically. To hear about new releases, select **Watch** → **Custom** → **Releases** on the [repository](https://github.com/b1tninja/continuous).

To update, download the new release's `.vsix` and run the install command again with `--force`. Your settings and `~/.continuous` configuration are kept.

To go back to an earlier version, install that release's `.vsix` the same way. Older releases are on the [releases page](https://github.com/b1tninja/continuous/releases).

## Troubleshooting

| Symptom                                           | Fix                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `code` is not recognised                          | In VS Code run **Shell Command: Install 'code' command in PATH**, then open a new terminal.          |
| Install fails with "Extension ... is not a valid" | The download is incomplete. Re-download and compare the SHA-256 checksum.                            |
| Install says the extension is not compatible      | Your VS Code is older than 1.105. Update VS Code, then install again.                                |
| The Continuous icon does not appear               | Reload the window, then check **View → Appearance** for the activity bar setting.                    |
| Models do not load                                | Check your provider credentials and use **Test connection** or the refresh icon in the model picker. |
| A corporate proxy blocks GitHub downloads         | Download the `.vsix` on another machine and copy it over.                                            |

## Building from source

```bash
git clone https://github.com/b1tninja/continuous.git
cd continuous
node ./scripts/build-packages.js
cd gui && npm ci && npm run build && cd ..
cd extensions/vscode && npm ci && npm run prepackage && npm run package
npx @vscode/vsce package --no-dependencies
```

Node.js 20.20.1 or later is required (see `.nvmrc`). Building on Windows also needs the Visual Studio Build Tools for native modules.
