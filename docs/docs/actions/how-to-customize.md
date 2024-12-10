---
title: How to customize
description: How to customize Actions
keywords: [customize, actions]
sidebar_position: 5
---

## Built-in slash commands

Continue has a large library of built-in slash commands, but when you first install we only display the most commonly used ones, like “/edit”, “/comment”, and “/share”. To add more actions, you can open [config.json](../reference.md) and add them to the `slashCommands` array.

## Custom slash commands

There are two ways to add custom slash commands:

1. With `.prompt` files - this is recommended in most cases. See the full reference [here](../customize/deep-dives/prompt-files.md).
2. With `config.ts` - this gives you full programmatic access to the LLM, IDE, and other important entities by writing a JavaScript/TypeScript function

### Custom Slash Commands with `config.ts`

<!-- TODO: We need a config.ts reference -->
<!-- :::tip[config.ts]
Before adding a custom slash command, we recommend reading the [introduction to `config.ts`](../customize/deep-dives/ways-to-configure.md).
::: -->

If you want to go a step further than writing custom commands with natural language, you can write a custom function that returns the response. This requires using `config.ts` instead of `config.json`.

To do this, push a new `SlashCommand` object to the `slashCommands` list. This object contains "name", the name that you will type to invoke the slash command, "description", the description seen in the dropdown menu, and "run". The `run` function is any async generator that should yield strings as you want them to be streamed to the UI. As an argument to the function, you have access to a `ContinueSDK` object with utilities such as access to certain information/actions within the IDE, the current language model, and a few other utilities. For example, here is a slash command that generates a commit message:

```typescript title="config.ts"
export function modifyConfig(config: Config): Config {
  config.slashCommands?.push({
    name: "commit",
    description: "Write a commit message",
    run: async function* (sdk) {
      // The getDiff function takes a boolean parameter that indicates whether
      // to include unstaged changes in the diff or not.
      const diff = await sdk.ide.getDiff(false); // Pass false to exclude unstaged changes
      for await (const message of sdk.llm.streamComplete(
        `${diff}\n\nWrite a commit message for the above changes. Use no more than 20 tokens to give a brief description in the imperative mood (e.g. 'Add feature' not 'Added feature'):`,
        new AbortController().signal,
        {
          maxTokens: 20,
        },
      )) {
        yield message;
      }
    },
  });
  return config;
}
```
<!-- TODO: We need a config.ts reference -->
<!-- For full `config.ts` reference, see [here](reference/config-ts.md). -->

## Other custom actions

Currently the other action triggers are not open for configuration, but we plan to allow this via .prompt files in the future.

<!-- For any actions defined in a .prompt file, you can [configure a specific model](TODO). -->
