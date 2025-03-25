---
description: Configuration
keywords: [config, settings, customize]
---

# Configuration

## YAML Config

Continue can be deeply customized. Local user-level configuration is stored and can be edited in your home directory in `config.yaml`:

To open `config.yaml`, you can click the "gear" icon in the header of the Continue Chat sidebar to open the settings page, and then click `Open Assistant configuration` to open the file. When editing this file, you can see the available options suggested as you type, or check the reference below.

- `~/.continue/config.yaml` (MacOS / Linux)
- `%USERPROFILE%\.continue\config.yaml` (Windows)

To open your configuration file, you can click the "gear" icon in the bottom right corner of the Continue Chat sidebar. When editing this file, you can see the available options suggested as you type, or check the reference below.

When you save a config file from the IDE, Continue will automatically refresh to take into account your changes. A config file is automatically created the first time you use Continue, and always automatically generated with default values if it doesn't exist.

See the full reference for `config.yaml` [here](../../reference.md).

## Deprecated configuration methods

:::info
View the `config.json` migration guide [here](../../yaml-migration.md)
:::

- [`config.json`](../../json-reference.md) - The original configuration format which is stored in a file at the same location as `config.yaml`
- [`.continuerc.json`](#continuercjson) - Workspace-level configuration
- [`config.ts`](#configts) - Advanced configuration (probably unnecessary) - a TypeScript file in your home directory that can be used to programmatically modify (_merged_) the `config.json` schema:
  - `~/.continue/config.ts` (MacOS / Linux)
  - `%USERPROFILE%\.continue\config.ts` (Windows)

### `.continuerc.json`

The format of `.continuerc.json` is the same as `config.json`, plus one _additional_ property `mergeBehavior`, which can be set to either "merge" or "overwrite". If set to "merge" (the default), `.continuerc.json` will be applied on top of `config.json` (arrays and objects are merged). If set to "overwrite", then every top-level property of `.continuerc.json` will overwrite that property from `config.json`.

Example

```json title=".continuerc.json"
{
  "tabAutocompleteOptions": {
    "disable": true
  },
  "mergeBehavior": "overwrite"
}
```

### `config.ts`

To programatically extend `config.json`, you can place a `config.ts` script in same directory as `config.json` and export a `modifyConfig` function, like:

```ts title="config.ts"
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

This can be used for slash commands and custom context providers.
