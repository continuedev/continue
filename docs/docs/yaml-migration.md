---
title: Config Migration to YAML
description: Reference for migrating from JSON to YAML Continue configuration.
keywords: [config, yaml, configuration, customize, customization, migration]
---

# Migrating Config to YAML

Continue's YAML configuration format provides more readable, maintainable, consistent configuration files, as well as new configuration options and removal of some old configuration options. YAML is the preferred format and will be used to integrate with future Continue products. Below is a brief guide for migration from `config.json` to `config.yaml`.

See also

- [Intro to YAML](https://yaml.org/)
- [JSON Continue Config Reference](/reference)
- [YAML Continue Config Reference](/yaml-reference)

### 1. Create YAML file

Create a `config.yaml` file in your Continue Global Directory (`~/.continue` on Mac, `%USERPROFILE%\.continue`) alongside your current `config.json` file. If a `config.yaml` file is present, it will be loaded instead of `config.json`.

Give your configuration a `name` and a `version`:

```yaml title="config.yaml"
name: my-configuration
version: 0.0.1
```

### 2. Map Models

Add all model configurations in `config.json`, including models in `models`, `tabAutocompleteModel`, `embeddingsProvider`, and `reranker`, to the `models` section of your new YAML config file. A new `roles` YAML field specifies which roles a model can be used for, with possible values `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize`.

- `models` in config should have `roles: chat`
- `tabAutocompleteModel`(s) in config should have `roles: autocomplete`
- `embeddingsProvider` in config should have `roles: embed`
- `reranker` in config should have `roles: rerank`
- `experimental.modelRoles` is replaced by simply adding roles to the model
  - `inlineEdit` -> e.g. `roles: [chat, edit]`
  - `applyCodeBlock` -> e.g. `roles: [chat, apply]`

Model-level `requestOptions` remain, with minor changes. See [YAML Continue Config Reference](/yaml-reference#requestoptions)

Model-level `completionOptions` are replaced by `defaultCompletionOptions`, with minor changes. See [YAML Continue Config Reference](/yaml-reference#completionoptions)

<!-- TODO - API KEY -> apiKeySecret? -->
<!-- TODO - ollama autodetect supported? -->

**Before**

```json title="config.json"
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai",
      "model": "gpt-4",
      "apiKey": "YOUR_API_KEY",
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
    "apiKey": "<API_KEY>",
    "maxChunkSize": 256,
    "maxBatchSize": 5
  },
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-2",
      "apiKey": "<VOYAGE_API_KEY>"
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
    defaultCompletionOptions:
      temperature: 0.5
      maxTokens: 2000'
    roles: [chat, edit]
    apiKey: <API_KEY>
  - name: My Voyage Reranker
    provider: voyage
    roles: rerank
    apiKey: <API_KEY>
  - name: My Starcoder
    provider: ollama
    model: starcoder2:3b
    roles: autocomplete
  - name: My Ada Embedder
    provider: openai
    roles: embed
    apiKey: <API_KEY>
  - name: Ollama Autodetect
    provider: ollama
    model: AUTODETECT
  - name: My Open AI Compatible Model - Apply
    provider: openai
    apiBase: http://3.3.3.3/v1
    model: my-openai-compatible-model
    requestOptions:
      headers:
        X-Auth-Token: <API_KEY>
    roles: [chat, apply]
```

Note that the `repoMapFileSelection` experimental model role has been deprecated.

### 3. Map Context Providers

The JSON `contextProviders` and `docs` fields are replaced by the YAML `context` array.

- JSON `name` maps to `uses`
- JSON `params` map to `with`
- Use multiple `docs` entries rather than the array of docs in the JSON format
<!-- TODO is this docs not correct ?^ -->

**Before**

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs",
      "params": {
        "startUrl": "https://docs.continue.dev/intro"
      }
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
  ],
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
context:
  - uses: docs
    with:
      startUrl: https://docs.nestjs.com/
      title: nest.js
  - uses: docs
    with:
      startUrl: https://mysite.com/docs/
      title: My Site
  - uses: codebase
    with:
      nRetrieve: 30
      nFinal: 3
  - uses: diff
```

## Map MCP Servers

<!-- TODO this is definitely wrong -->

**Properties:**

- `name` (**required**): The name of the MCP server.
- `command` (**required**): The command used to start the server.
- `args`: An optional array of arguments for the command.
- `env`: An optional map of environment variables for the server process.

**Before**

```json title="config.json"
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "uvx",
          "args": ["mcp-server-sqlite", "--db-path", "/Users/NAME/test.db"]
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
```

---

## Deprecated configuration options

The following top-level fields from `config.json` have been deprecated

- Slash commands (JSON `slashCommands`)
- top-level `requestOptions`
- top-level `completionOptions`
- `tabAutocompleteOptions`
- `analytics`
- `customCommands`
- `disableSessionTitles`
- `experimental`
- `allowAnonymousTelemetry` (moved to user/IDE level)
- `ui` (moved to user/IDE level)
- `userToken`
- `systemMessage`
- `disableIndexing` (moved to user/IDE level)

## New Configuration options

The YAML configuration format offers new configuration options not available in the JSON format. See the [YAML Config Reference](/yaml-reference) for more information.
