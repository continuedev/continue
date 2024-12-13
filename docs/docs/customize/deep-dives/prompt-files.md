---
title: Prompt files
---

Prompt files provide a convenient way to standardize common patterns and share a collection of LLM prompts with your team. They make it easy to build and use these prompts.

## Quick start

<!-- :::tip[Prompt library]
To assist you in getting started, [we've curated a small library of `.prompt` files](https://github.com/continuedev/prompt-file-examples). We encourage community contributions to this repository, so please consider opening up a pull request with your own prompts!
::: -->

Below is a quick example of setting up a prompt file to de

1. Create a folder called `.continue/prompts` at the top level of your workspace (or you can use the button in the UI by typing @, selecting "Prompt Files", and selecting "New Prompt File").
2. Add a file called `rails.prompt` to this folder.
3. Write the following contents to `rails.prompt` and save.

```
name: Rails Project
description: Information about this project
---
Attached is a summary of the current Ruby on Rails application, including the @Gemfile and database schema in @db/schema.rb
```

Now to use this prompt, you can highlight code and use <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> to select it in the Continue sidebar.

Then, type "@", select "Prompt files", and choose the one called "Rails Project". You can now ask any question as usual and the LLM will have the information from your .prompt file.

## Format

The format is inspired by [HumanLoops's .prompt file](https://docs.humanloop.com/docs/prompt-file-format), with additional templating to reference files, URLs, and context providers.

:::info
The current state of this format is experimental and subject to change
:::

### Preamble

The "preamble" is everything above the `---` separator, and lets you specify model parameters. It uses YAML syntax and currently supports the following parameters:

- `name` - The display title
- `description` - The description you will see in the dropdown
- `version` - Can be either "1" (for legacy prompt files) or "2" (this is the default and does not need to be set)

If you don't need any of these parameters, you can leave out the preamble and do not need to include the `---` separator.

### Context

Many [context provider](../context-providers.md) can be referenced by typing "@" followed by the name of the context provider.

- `@terminal` - The contents of the terminal
- `@https://github.com/continuedev/continue` - The contents of a URL
- `@src/index.ts` - The contents of a file (VS Code only)

## Feedback

If you have ideas about how to improve the `.prompt` file format, please reach out on [Discord](https://discord.gg/NWtdYexhMs).
