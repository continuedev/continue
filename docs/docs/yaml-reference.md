---
title: Config YAML Reference
description: Reference for the Continue configuration YAML file
keywords: [config, yaml, configuration, customize, customization]
---

# Config YAML Reference

<!-- TODO - data and packages sections -->

Continue can be configured using a YAML file `config.yaml` which for local configuration can be placed in your global `.continue` folder (`~/.continue` on Mac, `%USERPROFILE%\.continue`)

Below are details for each property that can be set in `config.yaml`.

:::info
Config YAML does not work alongside `config.json` - it replaces it. View the **[Migration Guide](/yaml-migration)**
:::

**All properties at all levels are optional unless explicitly marked as required.**

## Properties

The top-level properties in the `config.yaml` configuration file are:

- [`name`](#name) (**required**)
<!-- - [`packages`](#packages) -->
- [`models`](#models)
- [`context`](#context)
<!-- - [`data`](#data) -->
- [`tools`](#tools)
- [`mcpServers`](#mcpservers)

---

### `name`

The `name` property specifies the name of your project or configuration.

```yaml title="config.yaml"
name: MyProject
```

---

### `models`

The `models` section defines the language models used in your configuration. Models are used for functionalities such as chat, editing, and summarizing.

**Properties:**

- `name` (**required**): A unique name to identify the model within your configuration.
- `provider` (**required**): The provider of the model (e.g., `openai`, `ollama`).
- `model` (**required**): The specific model name (e.g., `gpt-4`, `starcoder`).
- `roles`: An array specifying the roles this model can fulfill, such as `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize`.
- `defaultCompletionOptions`: Default completion options for model settings.

  **Properties:**

  - `contextLength`: Maximum context length of the model, typically in tokens.
  - `maxTokens`: Maximum number of tokens to generate in a completion.
  - `temperature`: Controls the randomness of the completion. Values range from `0.0` (deterministic) to `1.0` (random).
  - `topP`: The cumulative probability for nucleus sampling.
  - `topK`: Maximum number of tokens considered at each step.
  - `stop`: An array of stop tokens that will terminate the completion.
  - `n`: Number of completions to generate.

- `requestOptions`: HTTP request options specific to the model.

  **Properties:**

  - `timeout`: Timeout for each request to the language model.
  - `verifySsl`: Whether to verify SSL certificates for requests.
  - `caBundlePath`: Path to a custom CA bundle for HTTP requests.
  - `proxy`: Proxy URL for HTTP requests.
  - `headers`: Custom headers for HTTP requests.
  - `extraBodyProperties`: Additional properties to merge with the HTTP request body.
  - `noProxy`: List of hostnames that should bypass the specified proxy.
  - `clientCertificate`: Client certificate for HTTP requests.
    - `cert`: Path to the client certificate file.
    - `key`: Path to the client certificate key file.
    - `passphrase`: Optional passphrase for the client certificate key file.

#### Example:

```yaml title="config.yaml"
models:
  - name: GPT-3.5 Turbo
    provider: openai
    model: gpt-3.5-turbo
    roles:
      - chat
      - autocomplete
    defaultCompletionOptions:
      temperature: 0.7
      maxTokens: 1500
    requestOptions:
      headers:
        Authorization: Bearer YOUR_API_KEY
  - name: Custom LLM
    provider: custom
    model: my-custom-model
    roles:
      - summarize
    defaultCompletionOptions:
      temperature: 0.3
      topP: 0.9
```

---

### `context`

The `context` section defines context providers, which supply additional information or context to the language models. Each context provider can be configured with specific parameters.

More information about usage/params for each context provider can be found [here](/customize/context-providers)

**Properties:**

- `uses` (**required**): The identifier or name of the context provider (e.g., `code`, `docs`, `web`).
- `with`: Optional parameters to configure the context provider's behavior.

**Example:**

```yaml title="config.yaml"
context:
  - uses: diff
  - uses: docs
    with:
      startUrl: https://docs.example.com/start
      rootUrl: https://docs.example.com
      maxDepth: 2
```

---

### `tools`

<!-- TODO how does this actually work -->

The `tools` section specifies external tools or APIs that can be used within your configuration.

**Properties:**

- `url` (**required**): The URL of the tool's API or endpoint.
- `apiKey`: An optional API key required by the tool.

**Example:**

```yaml title="config.yaml"
tools:
  - url: https://api.exampletool.com/tool1
    apiKey: YOUR_API_KEY
```

---

### `mcpServers`

<!-- TODO is this correct? -->

The [Model Context Protocol](https://modelcontextprotocol.io/introduction) is a standard proposed by Anthropic to unify prompts, context, and tool use. Continue supports any MCP server with the MCP context provider.

**Properties:**

- `name` (**required**): The name of the MCP server.
- `command` (**required**): The command used to start the server.
- `args`: An optional array of arguments for the command.
- `env`: An optional map of environment variables for the server process.

**Example:**

```yaml title="config.yaml"
mcpServers:
  - name: DevelopmentServer
    command: npm
    args:
      - run
      - dev
    env:
      PORT: "3000"
```

<!-- ### `data`

The `data` section specifies data providers used in your configuration. Data providers supply data or resources for use in various operations.

**Properties:**

- `provider` (**required**): The name of the data provider.

**Example:**

```yaml title="config.yaml"
data:
  - provider: embeddings
```

--- -->

---

## Complete YAML Config Example

Putting it all together, here's a complete example of a `config.yaml` configuration file:

```yaml title="config.yaml"
name: MyProject

models:
  - name: GPT-4
    provider: openai
    model: gpt-4
    roles:
      - chat
      - edit
    defaultCompletionOptions:
      temperature: 0.5
      maxTokens: 2000
    requestOptions:
      headers:
        Authorization: Bearer YOUR_OPENAI_API_KEY
  - name: Ollama Starcoder
    provider: ollama
    model: starcoder
    roles:
      - autocomplete
    defaultCompletionOptions:
      temperature: 0.3
      stop:
        - "\n"

context:
  - uses: diff
  - uses: docs
    with:
      startUrl: https://docs.example.com/introduction
      rootUrl: https://docs.example.com
      maxDepth: 3

tools:
  - url: https://api.exampletool.com
    apiKey: YOUR_TOOL_API_KEY

mcpServers:
  - name: DevServer
    command: npm
    args:
      - run
      - dev
    env:
      PORT: "3000"
```
