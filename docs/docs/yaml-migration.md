---
title: Config Migration to YAML
description: Reference for migrating from JSON to YAML Continue configuration.
keywords: [config, yaml, configuration, customize, customization, migration]
---

# Migrating Config to YAML

Continue's YAML configuration format provides more readable, maintainable, consistent configuration files, as well as new configuration options and removal of some old configuration options. YAML is the preferred format and will be used to integrate with future Continue products. Below is a brief guide for migration from `config.json` to `config.yaml`.

See also

- [Intro to YAML](https://yaml.org/)
- [JSON Continue Config Reference](/json-reference)
- [YAML Continue Config Reference](/reference)

## Create YAML file

Create a `config.yaml` file in your Continue Global Directory (`~/.continue` on Mac, `%USERPROFILE%\.continue`) alongside your current `config.json` file. If a `config.yaml` file is present, it will be loaded instead of `config.json`.

Give your configuration a `name` and a `version`:

```yaml title="config.yaml"
name: my-configuration
version: 0.0.1
```

### Models

Add all model configurations in `config.json`, including models in `models`, `tabAutocompleteModel`, `embeddingsProvider`, and `reranker`, to the `models` section of your new YAML config file. A new `roles` YAML field specifies which roles a model can be used for, with possible values `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize`.

- `models` in config should have `roles: [chat]`
- `tabAutocompleteModel`(s) in config should have `roles: [autocomplete]`
- `embeddingsProvider` in config should have `roles: [embed]`
- `reranker` in config should have `roles: [rerank]`
- `experimental.modelRoles` is replaced by simply adding roles to the model
  - `inlineEdit` -> e.g. `roles: [chat, edit]`
  - `applyCodeBlock` -> e.g. `roles: [chat, apply]`

Model-level `requestOptions` remain, with minor changes. See [YAML Continue Config Reference](/reference#requestoptions)

Model-level `completionOptions` are replaced by `defaultCompletionOptions`, with minor changes. See [YAML Continue Config Reference](/reference#completionoptions)

<!-- TODO - ollama autodetect supported? -->

**Before**

```json title="config.json""
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai",
      "model": "gpt-4",
      "apiKey": "<YOUR_OPENAI_API_KEY>",
      "completionOptions": {
        "temperature": 0.5,
        "maxTokens": 2000
      }
    },
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "AUTODETECT"
    },
    {
      "title": "My Open AI Compatible Model",
      "provider": "openai",
      "apiBase": "http://3.3.3.3/v1",
      "model": "my-openai-compatible-model",
      "requestOptions": {
        "headers": { "X-Auth-Token": "<API_KEY>" }
      }
    }
  ],
  "tabAutocompleteModel": {
    "title": "My Starcoder",
    "provider": "ollama",
    "model": "starcoder2:3b"
  },
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiKey": "<YOUR_OPENAI_API_KEY>",
    "maxChunkSize": 256,
    "maxBatchSize": 5
  },
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-2",
      "apiKey": "<YOUR_VOYAGE_API_KEY>"
    }
  }
}
```

**After**

```yaml title="config.yaml"
models:
  - name: GPT-4
    provider: openai
    model: gpt-4
    apiKey: <YOUR_OPENAI_KEY>
    defaultCompletionOptions:
      temperature: 0.5
      maxTokens: 2000
    roles:
      - chat
      - edit

  - name: My Voyage Reranker
    provider: voyage
    apiKey: <YOUR_VOYAGE_KEY>
      - rerank

  - name: My Starcoder
    provider: ollama
    model: starcoder2:3b
    roles:
      - autocomplete

  - name: My Ada Embedder
    provider: openai
    apiKey: <YOUR_ADA_API_KEY>
    roles:
      - embed

  - name: Ollama Autodetect
    provider: ollama
    model: AUTODETECT

  - name: My Open AI Compatible Model - Apply
    provider: openai
    model: my-openai-compatible-model
    apiBase: http://3.3.3.3/v1
    requestOptions:
      headers:
        X-Auth-Token: <MY_API_KEY>
    roles:
      - chat
      - apply
```

Note that the `repoMapFileSelection` experimental model role has been deprecated.

### Context Providers

The JSON `contextProviders` field is replaced by the YAML `context` array.

- JSON `name` maps to `provider`
- JSON `params` map to `params`

**Before**

```json title="config.json""
{
  "contextProviders": [
    {
      "name": "docs"
    },
    {
      "name": "codebase",
      "params": {
        "nRetrieve": 30,
        "nFinal": 3
      }
    },
    {
      "name": "diff",
      "params": {}
    }
  ]
}
```

**After**

```yaml title="config.yaml"
context:
  - provider: docs

  - provider: codebase
    params:
      nRetrieve: 30
      nFinal: 3

  - provider: diff
```

### System Message

The `systemMessage` property has been replaced with a `rules` property that takes an array of strings.

**Before**

```json title="config.json""
{
  "systemMessage": "Always give concise responses"
}
```

**After**

```yaml title="config.yaml"
rules:
  - Always give concise responses
```

### Prompts

Rather than with `customCommands`, you can now use the `prompts` field to define custom prompts.

**Before**

```json title="config.json""
{
  "customCommands": [
    {
      "name": "check",
      "description": "Check for mistakes in my code",
      "prompt": "{{{ input }}}\n\nPlease read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:\n- Syntax errors\n- Logic errors\n- Security vulnerabilities\n- Performance issues\n- Anything else that looks wrong\n\nOnce you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found."
    }
  ]
}
```

**After**

```yaml title="config.yaml"
prompts:
  - name: check
    description: Check for mistakes in my code
    prompt: |
      Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:
        - Syntax errors
        - Logic errors
        - Security vulnerabilities
        - Performance issues
        - Anything else that looks wrong

      Once you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found.
```

### Documentation

Documentation is largely the same, but the `title` property has been replaced with `name`. The `startUrl`, `rootUrl`, and `faviconUrl` properties remain.

**Before**

```json title="config.json""
{
  "docs": [
    {
      "startUrl": "https://docs.nestjs.com/",
      "title": "nest.js"
    },
    {
      "startUrl": "https://mysite.com/docs/",
      "title": "My site"
    }
  ]
}
```

**After**

```yaml title="config.yaml"
docs:
  - name: nest.js
    startUrl: https://docs.nestjs.com/

  - name: My site
    startUrl: https://mysite.com/docs/
```

### MCP Servers

**Properties:**

- `name` (**required**): The name of the MCP server.
- `command` (**required**): The command used to start the server.
- `args`: An optional array of arguments for the command.
- `env`: An optional map of environment variables for the server process.

**Before**

```json title="config.json""
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "uvx",
          "args": ["mcp-server-sqlite", "--db-path", "/Users/NAME/test.db"],
          "env": {
            "KEY": "<VALUE>"
          }
        }
      }
    ]
  }
}
```

**After**

```yaml title="config.yaml"
mcpServers:
  - name: My MCP Server
    command: uvx
    args:
      - mcp-server-sqlite
      - --db-path
      - /Users/NAME/test.db
    env:
      KEY: <VALUE>
```

---

## Deprecated configuration options

Some deprecated `config.json` settings are no longer stored in config and have been moved to be editable through the [User Settings Page](./customize/settings.md) (Gear Icon). If found in `config.json`, they will be migrated to the [User Settings Page](./customize/settings.md) and removed from `config.json`.

See the [JSON Config Reference](./reference#fully-deprecated-settings) for more information on fully deprecated options.

The following top-level fields from `config.json` still work when using `config.json` but have been deprecated and don't have a YAML equivalent:

- Slash commands (JSON `slashCommands`)
- top-level `requestOptions`
- top-level `completionOptions`
- `tabAutocompleteOptions`
  - `disable`
  - `maxPromptTokens`
  - `debounceDelay`
  - `maxSuffixPercentage`
  - `prefixPercentage`
  - `template`
  - `onlyMyCode`
- `analytics`

The following top-level fields from `config.json` have been deprecated. Most UI-related and user-specific options will move into a settings page in the UI

- `customCommands`
- `experimental`
- `userToken`

## New Configuration options

The YAML configuration format offers new configuration options not available in the JSON format. See the [YAML Config Reference](./reference) for more information.
