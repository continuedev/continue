---
title: Actions
description: How to use Actions
sidebar_label: How to use it
keywords: [how, slash, commands, prompt, right click, quick fix, debug, action]
sidebar_position: 1
---

![actions](/img/actions.gif)

## How to use it

Actions are shortcuts for common use cases. For example, you might want to review code, write tests, or add a docstring.

### Slash commands

The most common way to invoke an action is with a slash command. These are shortcuts that can be activated by typing '/' in a chat session (press <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) or <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains)), and selecting from the dropdown.

![slash-commands](/img/slash-commands.png)

In YAML assistants, slash commands are generated from [`prompts` blocks](../hub/blocks/block-types.md#prompts).

Learn more about slash commands [here](../customize/slash-commands.mdx).

:::info
Important: For assistants, slash commands only come from `prompts` blocks. When using older `config.json` configuration, other slash commands like `/share` and `/cmd` are included by default.
:::

### Prompt files

It is also possible to write your own slash command by defining a “.prompt file.” Prompt files can be as simple as a text file, but also include templating so that you can refer to files, URLs, highlighted code, and more.

Learn more about prompt files [here](../customize/deep-dives/prompt-files.md)

### Other triggers for Actions (VS Code)

:::info
Currently all of these are only available in VS Code
:::

To make common use cases even more accessible, we provide a handful of other ways to invoke actions.

#### Quick actions

Quick Actions are displayed as buttons above top-level classes and functions in your source code, letting you invoke actions with one click. They can also be customized with .prompt files to perform custom actions.

![quick-actions](/img/quick-actions.png)

By default, quick actions are disabled, but can be enabled with the “Continue: Enable Quick Actions” in VS Code settings.

#### Right click actions

Right click actions let you highlight a desired region of code, right click, and then select an action from the dropdown menu.

![context-menu](/img/context-menu.png)

#### Debug action

The debug action is a special built-in keyboard shortcut in the VS Code extension. Use <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>R</kbd> to instantly copy the contents of the current terminal into the chat sidebar and get debugging advice.

#### Quick fixes

Whenever you see red/yellow underlines in your code indicating errors, you can place your cursor nearby and VS Code will display a lightbulb icon. Either clicking the lightbulb or using the keyboard shortcut <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> will show a dropdown menu of quick fixes. One of these will be the “Ask Continue” action. Either click or use <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> again and Continue will attempt to help solve the problem.

![ask-continue](/img/ask-continue.png)
