# Building the VS Code Extension

Builds the `.vsix` package using Docker, so nothing needs to be installed on the host beyond Docker itself.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running

## Build the image

Run once from the repository root. This installs Node.js 20.20.1, Vite, and the required build tools into the image.

```bash
docker build -f Dockerfile.vscode-build -t continue-vscode-builder .
```

## Build the extension

```bash
docker run --rm -v "$(pwd)":/workspace continue-vscode-builder
```

The build runs inside the container against the mounted source tree. When it finishes you should see:

```
Done. Extension is at extensions/vscode/build/continue-*.vsix
```

The `.vsix` file is written into `extensions/vscode/build/` in your local directory.

## Pre-release build

```bash
docker run --rm -v "$(pwd)":/workspace -e PRERELEASE=1 continue-vscode-builder
```

This runs `npm run package:pre-release` instead, which passes `--pre-release` to `vsce`. The resulting `.vsix` has an odd minor version (e.g. `1.3.x`) and installs into the VS Code pre-release extension channel.

## Cross-compiling for a different platform

The `.vsix` bundles platform-specific native binaries: onnxruntime, LanceDB, SQLite3, and ripgrep. A build targeting `linux-x64` (the default when running in a standard amd64 container) will not work on macOS or Windows.

To target a different platform, pass `CONTINUE_VSCODE_TARGET`. The build fetches the right pre-built binaries from npm for that target — nothing needs to be compiled locally.

```bash
# macOS Apple Silicon
docker run --rm -v "$(pwd)":/workspace \
  -e CONTINUE_VSCODE_TARGET=darwin-arm64 \
  continue-vscode-builder

# macOS Intel
docker run --rm -v "$(pwd)":/workspace \
  -e CONTINUE_VSCODE_TARGET=darwin-x64 \
  continue-vscode-builder
```

Supported values for `CONTINUE_VSCODE_TARGET`:

| Value          | Platform              |
| -------------- | --------------------- |
| `darwin-arm64` | macOS — Apple Silicon |
| `darwin-x64`   | macOS — Intel         |
| `linux-arm64`  | Linux — ARM64         |
| `linux-x64`    | Linux — x86-64        |
| `win32-arm64`  | Windows — ARM64       |
| `win32-x64`    | Windows — x86-64      |

## Install the extension

In VS Code, right-click the `.vsix` file and select **Install Extension VSIX**, or run:

```bash
code --install-extension extensions/vscode/build/continue-*.vsix
```

## Reverting to the Marketplace version

Uninstall the locally-built extension and reinstall from the Marketplace:

```bash
code --uninstall-extension Continue.continue
code --install-extension Continue.continue
```

Or uninstall via the Extensions panel, then search for "Continue" and install from there.

## Notes

- `node_modules` directories are created inside the mounted source tree on the first run. Subsequent runs reuse them and are significantly faster.
