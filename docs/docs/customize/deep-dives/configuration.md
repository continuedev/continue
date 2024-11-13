---
description: Configuration
keywords: [config, settings, customize]
---

# Configuration

Continue can be deeply customized. User-level configuration is stored and can be edited in your home directory in [`config.json`](#configjson):

- `~/.continue/config.json` (MacOS / Linux)
- `%USERPROFILE%\.continue\config.json` (Windows)

To open `config.json`, you can click the "gear" icon in the bottom right corner of the Continue Chat sidebar. When editing this file, you can see the available options suggested as you type, or check the reference below.

When you save `config.json`, Continue will automatically refresh to take into account your changes. `config.json` is automatically created the first time you use Continue. `config.json` is automatically generated if it doesn't exist.

In the vast majority of cases, you will only need to edit `config.json`. However, Continue offers two additional ways to customize configuration:

- [`.continuerc.json`](#continuercjson) - Workspace-level configuration. If you'd like to scope certain settings to a particular workspace, you can add a `.continuerc.json` to the root of your project. This can be set to merge with _or_ override the user-level `config.json`
- [`config.ts`](#configts) - Advanced configuration (probably unnecessary) - a TypeScript file in your home directory that can be used to programmatically modify (_merged_) the `config.json` schema:
  - `~/.continue/config.ts` (MacOS / Linux)
  - `%USERPROFILE%\.continue\config.ts` (Windows)

## `config.json`

See the full reference for `config.json` [here](../../reference.md).

## `.continuerc.json`

The format of `.continuerc.json` is the same as `config.json`, plus one _additional_ property `mergeBehavior`, which can be set to either "merge" or "overwrite". If set to "merge" (the default), `.continuerc.json` will be applied on top of `config.json` (arrays and objects are merged). If set to "overwrite", then every top-level property of `.continuerc.json` will overwrite that property from `config.json`.

Example

```json title="config.json"
{
  "tabAutocompleteOptions": {
    "disable": true
  },
  "mergeBehavior": "overwrite"
}
```

## `config.ts`

To programatically extend `config.json`, you can place a `config.ts` script in same directory as `config.json` and export a `modifyConfig` function, like:

```ts title="config.ts"
export function modifyConfig(config: Config): Config {
  config.slashCommands?.push({
    name: "commit",
    description: "Write a commit message",
    run: async function* (sdk) {
      const diff = await sdk.ide.getDiff();
      for await (const message of sdk.llm.streamComplete(
        `${diff}\n\nWrite a commit message for the above changes. Use no more than 20 tokens to give a brief description in the imperative mood (e.g. 'Add feature' not 'Added feature'):`,
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

This can be used for slash commands and custom context providers.
