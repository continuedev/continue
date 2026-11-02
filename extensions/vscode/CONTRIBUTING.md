# Continue VS Code Extension

This is the Continue VS Code Extension. Its primary jobs are

1. Implement the IDE side of the Continue IDE protocol, allowing a Continue server to interact natively in an IDE. This happens in `src/continueIdeClient.ts`.
2. Open the Continue React app in a side panel. The React app's source code lives in the `gui` directory. The panel is opened by the `continue.openContinueGUI` command, as defined in `src/commands.ts`.

# How to run the extension

See [Environment Setup](../../CONTRIBUTING.md#environment-setup)

# Building and installing a VSIX locally

The extension is published as `b1tninja.continued`. To build and install it from source (this mirrors `.github/actions/build-vscode-extension`):

```bash
node scripts/build-packages.js           # from the repo root
(cd core && npm ci)
(cd gui && npm ci && npm run build)
cd extensions/vscode
npm ci                                   # runs install scripts: sqlite3 needs them
npm run prepackage -- --target linux-x64 # or darwin-arm64, darwin-x64, win32-x64, ... (fetches that platform's
                                         # ripgrep from npm and checks it against package-lock.json)
npm run package -- --target linux-x64    # writes build/continued-<version>.vsix
code --install-extension build/continued-*.vsix
```

For day-to-day development, run the `Launch extension` configuration (F5) instead; no VSIX is needed.

Note: the command, view and setting IDs still use the `continue.*` prefix, so this extension can't be installed alongside the original Continue extension.

# How to run and debug tests

After following the setup in [Environment Setup](../../CONTRIBUTING.md#environment-setup) you can run the `Extension (VSCode)` launch configuration in VS Code.
