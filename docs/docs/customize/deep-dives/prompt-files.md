---
title: Prompt files
---

Prompt files provide a convenient way to standardize common patterns and share a collection of LLM prompts with your team. They make it easy to build and use these prompts.

## Quick start

<!-- :::tip[Prompt library]
To assist you in getting started, [we've curated a small library of `.prompt` files](https://github.com/continuedev/prompt-file-examples). We encourage community contributions to this repository, so please consider opening up a pull request with your own prompts!
::: -->

Below is a quick example of setting up a project specific prompt file.

1. In the prompt window, type "@" and select "Prompt Files", and then select "New .prompt file" (or manually create a folder called `.continue/prompts` at the top level of your workspace.
2. Edit the prompt file, for instance like the one below.
3. Reload the editor (i.e. for VSCode: Cmd+Shift+P / Ctrl+Shift+P and select "Developer: Reload Window").
```
name: Rails Project
description: Information about this project
---
<system>
    You are a senior ruby on rails programmer giving expert advice with only ruby examples, no other languages.
</system>
```

This prompt is added to every prompt you send.

You can also add system wide prompts by adding a `name.prompt` file to the `.continue/prompts` folder in your home folder.

## Format

The format is inspired by [HumanLoops's .prompt file](https://docs.humanloop.com/docs/prompt-file-format), with additional templating to reference files, URLs, and context providers.

:::info
The current state of this format is experimental and subject to change
:::

### Preamble

The "preamble" is everything above the `---` separator, and lets you specify model parameters. It uses YAML syntax and currently supports the following parameters:

- `name` - The display title under @Prompt Files
- `description` - The description you will see in the dropdown
- `version` - Can be either "1" (for legacy prompt files) or "2" (this is the default and does not need to be set)

If you don't need any of these parameters, you can leave out the preamble and do not need to include the `---` separator.

### Context

Many [context provider](../context-providers.md) can be referenced by typing "@" followed by the name of the context provider. The currently supported list is:

- `@terminal` - The contents of the terminal
- `@currentFile` - The currently active file
- `@open` - All open files
- `@os` - Information about the operating system
- `@problems` - Problems reported by the language server in the active file
- `@repo-map` - A map of files in the repository
- `@tree` - A tree view of the repository structure

Or you can directly type URLs and file paths:

- `@https://github.com/continuedev/continue` - The contents of a URL
- `@src/index.ts` - The contents of a file (VS Code only)

All references will be attached as context items, rather than injected directly inline.

## Feedback

If you have ideas about how to improve the `.prompt` file format, please reach out on [Discord](https://discord.gg/NWtdYexhMs).
