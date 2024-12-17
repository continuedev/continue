---
title: Overview
description: Introduction to customizing Continue
keywords: [customize, configure, config]
---

Continue can be deeply customized. For example you might:

- **Change your Model Provider**.  Continue allows you to choose your favorite or even add multiple model providers. This allows you to use different models for different tasks, or to try another model if you're not happy with the results from your current model. Continue supports all of the popular model providers, including OpenAI, Anthropic, Microsoft/Azure, Mistral, and more.  You can even self host your own model provider if you'd like.  Learn more about [model providers](/customize/model-providers).
- **Select different model providers for each Compose feature**.  Different Continue features can use different model providers.  We call these _model types_.  For example, you can use a different model provider for chat than you do for autocomplete.  Learn more about [model types](/customize/model-types) .
- **Add a Context Provider**.  Context providers allow you to add information to your prompts, giving your LLM additional context to work with.  Context providers allow you to reference snippets from your codebase, or lookup relevant documentation, or use a search engine to find information and much more.  Learn more about [context providers](/customize/context-providers).
- **Create a Slash Command**.  Slash commands allow you to easily add custom functionality to Continue.  You can use a slash command that allows you to generate a shell command from natural language, or perhaps generate a commit message, or create your own custom command to do whatever you want.  Learn more about [slash commands](/customize/slash-commands).
- **Call external tools and functions**.  Unchain your LLM with the power of _Tools_.  You can call any external tool or function from your prompts.  Currently only available with Anthropic.  Learn more about [Tools](/customize/tools).

Whatever you choose, you'll probably start by editing `config.json`.

## Editing config.json

Most custom configuration is done by editing `config.json`. This file is a JSON file that allows you to customize Continue to your liking.  It is found at:

- MacOS and Linux: `~/.continue/config.json`
- Windows: `%USERPROFILE%\.continue\config.json`

You can easily access `config.json` from the Continue Chat sidebar.  Open the sidebar by pressing <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) or <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains) and click the "gear" icon in the bottom right corner.

![configure-continue](/img/configure-continue.png)

When editing this file, you can see the available options suggested as you type, or you can check the [full reference](./deep-dives/configuration.md).

:::info

`config.json` is created the first time you use Continue.  If you'd like to reset your configuration to the default, you can delete this file and Continue will automatically recreate it with the default settings.

:::

:::info

When you save `config.json`, Continue will automatically refresh to take into account your changes.

:::

## Per-workspace configuration

If you'd like to scope certain settings to a particular workspace, you can add a `.continuerc.json` to the root of your project. It has the same [definition](./deep-dives/configuration.md) as `config.json`, and will automatically be applied on top of the local config.json.

## Programmatic configuration

`config.json` can handle the vast majority of necessary configuration, so we recommend using it whenever possible. However, if you need to programmatically configure Continue, you can use `config.ts`, which is located at `~/.continue/config.ts` (MacOS / Linux) or `%USERPROFILE%\.continue\config.ts` (Windows).

For examples of how to use `config.ts`, see [writing custom slash commands](./tutorials/build-your-own-slash-command.md#custom-slash-commands) or [writing custom context providers](./tutorials/build-your-own-context-provider.md).
