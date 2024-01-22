---
title: Running Continue without Internet
description: How to run Continue without Internet
keywords: [no internet, air-gapped, local model]
---

# Running Continue without Internet

Continue can be run even on an air-gapped computer if you use a local model. Only a few adjustments are required for this to work.

1. Download the latest .vsix file from the [Open VSX Registry](https://open-vsx.org/extension/Continue/continue) and [install it to VS Code](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix).
2. Open `~/.continue/config.json` and set `"allowAnonymousTelemetry": false`. This will stop Continue from attempting requests to PostHog.
3. Also in `config.json`, set the default model to a local model. You can read about the available options [here](../model-setup/select-model.md).
4. Restart VS Code to ensure that the changes to `config.json` take effect.
