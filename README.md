<div align="center">

<img src="gui/public/logos/continued.png" alt="Continued logo" width="128" />

# Continued

**A community-maintained fork of the Continue VS Code extension.**

</div>

> **Unofficial fork.** Continued is not affiliated with, endorsed by, or supported by Continue Dev, Inc. The upstream `continuedev/continue` repository is no longer maintained. This fork carries its own changes (AWS Bedrock and Bedrock Mantle support, live model lists, and more) and is released separately.

## Install

Continued is not published to the VS Code Marketplace or Open VSX. Install it from a GitHub release. It needs VS Code 1.105 or newer.

1. Download the `.vsix` for your platform from the [latest release](https://github.com/b1tninja/continued/releases/latest) ([Continued 2.4.0](https://github.com/b1tninja/continued/releases/tag/v2.4.0-vscode)). There are builds for Windows (x64, Arm64), macOS (Apple Silicon, Intel), and Linux (x64, Arm64). Each release has a `SHA256SUMS.txt` to check the download against.
2. Install it, then reload VS Code (**Developer: Reload Window**):

   ```bash
   code --install-extension continued-win32-x64-2.4.0.vsix --force
   ```

Or, with the GitHub CLI (change `win32-x64` to your platform):

```bash
gh release download --repo b1tninja/continued --pattern "continued-win32-x64-*.vsix" --pattern SHA256SUMS.txt --dir continued-vsix
```

Continued (`b1tninja.continued`) installs alongside the original Continue extension and reads your existing `~/.continue` configuration. To update, install the next release's `.vsix` the same way.

The [install guide](docs/continued-install.md) has every platform's file name, checksum commands, unreleased builds from GitHub Actions, and troubleshooting.

## What's different from upstream

- **Amazon Bedrock**: one model list across the standard Bedrock endpoint and the Mantle endpoint. Mantle-only models are saved with the right provider automatically.
- **Live model lists**: after **Test connection** or the refresh button, the model picker shows the models your account can use, newest first.
- **Claude 4.6 and later**: uses adaptive thinking, which these models require.
- **Current models**: refreshed lists for Anthropic, OpenAI, Gemini and Bedrock.

## Documentation

The documentation is at [b1tninja.github.io/continued](https://b1tninja.github.io/continued/), built from `docs/`. It still describes upstream Continue in places and is being revised. What changed in each release is in the [release notes](https://github.com/b1tninja/continued/releases).

## Upstream

This fork starts from the final release of Continue (`continuedev/continue`, VS Code extension 2.0.0). Upstream is no longer maintained, and its CLI, JetBrains plugin and Marketplace listings are not part of this fork. Upstream's project history and contributors are at [continuedev/continue](https://github.com/continuedev/continue).

## License

Apache 2.0. The original work is © 2023–2026 Continue Dev, Inc. Changes in this fork are © 2026 b1tninja. See [LICENSE](LICENSE). This fork is not endorsed by or affiliated with Continue Dev, Inc.
