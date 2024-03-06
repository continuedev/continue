---
title: Overview
description: Continue can be deeply customized
keywords: [custom, slash commands, models, context providers]
---

# Overview

Continue can be deeply customized by editing `~/.continue/config.json` (`%userprofile%\.continue\config.json` for Windows) and `config.ts` on your machine. These files are created the first time you run Continue.

Currently, you can customize the following:

- [Models](../model-setup/select-model.md) and [providers](../model-setup/select-provider.md)
- [Context Providers](./context-providers.md) - Type '@' to easily add attachments to your prompt. Define which sources you want to reference, including GitHub Issues, terminal output, or automatically retrieved snippets from your codebase.
- [Slash Commands](./slash-commands.md) - Call custom prompts or programs written with our SDK by typing `/`.
- [Other Configuration](../reference/config.mdx) - Configure other settings like the system message and temperature.

If you'd like to share Continue configuration with others, you can add a `.continuerc.json` to the root of your project. It has the same JSON Schema definition as `config.json`, and will automatically be applied on top of the local `config.json`.
