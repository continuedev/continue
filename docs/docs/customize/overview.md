---
title: Overview
description: Introduction to customizing Continue
keywords: [customize, configure, config]
---

Continue can be deeply customized. For example you might:

- **Change your Model Provider**. Continue allows you to choose your favorite or even add multiple model providers. This allows you to use different models for different tasks, or to try another model if you're not happy with the results from your current model. Continue supports all of the popular model providers, including OpenAI, Anthropic, Microsoft/Azure, Mistral, and more. You can even self host your own model provider if you'd like. Learn more about [model providers](../customize/model-providers/).
- **Select different models for specific tasks**. Different Continue features can use different models. We call these _model roles_. For example, you can use a different model for chat than you do for autocomplete. Learn more about [model roles](./model-roles/) .
- **Add a Context Provider**. Context providers allow you to add information to your prompts, giving your LLM additional context to work with. Context providers allow you to reference snippets from your codebase, or lookup relevant documentation, or use a search engine to find information and much more. Learn more about [context providers](./context-providers.mdx).
- **Create a Slash Command**. Slash commands allow you to easily add custom functionality to Continue. You can use a slash command that allows you to generate a shell command from natural language, or perhaps generate a commit message, or create your own custom command to do whatever you want. Learn more about [slash commands](./deep-dives/slash-commands.mdx).
- **Call external tools and functions**. Unchain your LLM with the power of tools using [Agent](../agent/how-to-use-it.md). Add custom tools using [MCP Servers](./deep-dives/mcp.mdx)

Whatever you choose, you'll probably start by editing your Assistant.

## Editing your assistant

You can easily access your assistant configuration from the Continue Chat sidebar. Open the sidebar by pressing <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) or <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains) and click the Assistant selector above the main chat input. Then, you can hover over an assistant and click the `new window` (hub assistants) or `gear` (local assistants) icon.

![configure an assistant](/img/configure-continue.png)

- See [Editing Hub Assistants](../hub/assistants/edit-an-assistant.md) for more details on managing your hub assistant
- See the [Config Deep Dive](./deep-dives/configuration.md) for more details on configuring local assistants.
