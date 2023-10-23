---
title: Running Continue without Internet
description: How to run Continue without Internet
keywords: [no internet, air-gapped, local model]
---


# Running Continue without Internet

Continue can be run even on an air-gapped computer if you use a local model. You'll have to make a few adjustments for this to work.

1. Download the latest .vsix file from the [Open VSX Registry](https://open-vsx.org/extensions/vscode/Continue/continue) and [install it to VS Code](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix).
2. In VS Code settings, search "continue" and check the box that says "Manually Running Server". This will stop Continue from trying to kill and redownload the server binary.
3. Follow instructions to [run Continue manually](./manually-run-continue.md).
4. Open `~/.continue/config.py` and set `allow_anonymous_telemetry=False`. This will stop Continue from attempting requests to PostHog.
5. Also in `config.py`, set the default model to a local model. You can read about the available options [here](../customization/models.md).
6. Restart VS Code for changes to `config.py` to take effect.
