# Installing Continued

Continued is an unofficial, community-maintained fork of the Continue VS Code extension. It is **not** published to the VS Code Marketplace or Open VSX. You install it from a `.vsix` file.

Continued is not affiliated with Continue Dev, Inc.

**Requirements:** VS Code 1.105 or newer (or a VS Code-based editor built on it). Older versions cannot load the extension and will refuse to install it, so they keep the previously installed version.

## Option 1: install a build

There are no GitHub Releases for this fork yet, so builds come from GitHub Actions artifacts (see [Option 2](#option-2-download-a-build-from-github-actions)). Once releases are published, download the `.vsix` for your platform from the release page instead:

- Windows: `continued-win32-x64-<version>.vsix`
- Linux: `continued-linux-x64-<version>.vsix`
- macOS (Apple Silicon): `continued-darwin-arm64-<version>.vsix`

Then:

1. Verify the download (optional, recommended). Compare the checksum with the value you were given for that build:

   ```powershell
   # Windows PowerShell
   Get-FileHash .\continued-win32-x64-<version>.vsix -Algorithm SHA256
   ```

   ```bash
   # macOS / Linux
   shasum -a 256 continued-*.vsix
   ```

2. Install it:

   ```bash
   code --install-extension continued-win32-x64-<version>.vsix --force
   ```

   Or in VS Code: open the **Extensions** view, select **...** → **Install from VSIX...**, and choose the file.

3. Reload VS Code (**Developer: Reload Window**), then open the Continued icon in the activity bar.

Continued uses the extension ID `b1tninja.continued`. It installs alongside the original Continue extension (`Continue.continue`) without conflicts, so you do not need to uninstall Continue first.

> The artifact file names above follow the build's version format (`<package version>-<short commit SHA>`), so the exact file name includes the commit, for example `continued-win32-x64-1.3.40-62505d0.vsix`.

## Option 2: download a build from GitHub Actions

Every push to `main` can produce builds. Builds are created on request, so you may need to trigger one:

1. Open **Actions** → **PR Build And Upload VSIX** on `b1tninja/continued`.
2. Select **Run workflow**, choose `main`, and run it.
3. When the run finishes, open it and download the artifact for your platform: `win32-x64-vsix`, `linux-x64-vsix` or `darwin-arm64-vsix`.
4. Unzip the artifact and install the `.vsix` as in Option 1.

You need to be signed in to GitHub with access to the repository to download artifacts. Artifacts expire after the retention period set for the repository.

With the GitHub CLI you can download the latest Windows build in one command:

```powershell
gh run download --repo b1tninja/continued --name win32-x64-vsix --dir "$env:TEMP\continued-vsix"
code --install-extension (Get-ChildItem "$env:TEMP\continued-vsix" -Filter *.vsix | Select-Object -First 1).FullName --force
```

Replace `win32-x64-vsix` with `darwin-arm64-vsix` on a Mac and use `bash`/`zsh` syntax with `gh run download ... --dir "$TMPDIR/continued-vsix"`.

## Updating

VS Code does not update side-loaded `.vsix` files automatically. To update, download the new `.vsix` and run the install command again with `--force`. Your settings and `~/.continue` configuration are kept.

## Troubleshooting

| Symptom                                           | Fix                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `code` is not recognised                          | In VS Code run **Shell Command: Install 'code' command in PATH**, then open a new terminal.          |
| Install fails with "Extension ... is not a valid" | The download is incomplete. Re-download and compare the SHA-256 checksum.                            |
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
