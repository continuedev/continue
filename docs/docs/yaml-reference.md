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
Config YAML does not work alongside `config.json` - it replaces it. View the **[Migration Guide](/yaml-migration)**. `config.yaml` currently only works in VS Code pre-release.
:::

**All properties at all levels are optional unless explicitly marked as required.**

## Properties

The top-level properties in the `config.yaml` configuration file are:

- [`name`](#name) (**required**)
<!-- - [`packages`](#packages) -->
- [`version`](#version) (**required**)
- [`models`](#models)
- [`context`](#context)
- [`rules`](#rules)
- [`prompts`](#prompts)
- [`docs`](#docs)
  <!-- - [`data`](#data) -->
  <!-- - [`tools`](#tools) -->
- [`mcpServers`](#mcpservers)

---

### `name`

The `name` property specifies the name of your project or configuration.

```yaml title="config.yaml"
name: MyProject
```

### `version`

The `version` property specifies the version of your project or configuration.

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
  - name: GPT-4o
    provider: openai
    model: gpt-4o
    roles:
      - chat
      - edit
      - apply
    defaultCompletionOptions:
      temperature: 0.7
      maxTokens: 1500

  - name: Codestral
    provider: mistral
    model: codestral-latest
    roles:
      - autocomplete
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
  - uses: files
  - uses: code
  - uses: codebase
    with:
      nFinal: 10
  - uses: docs
  - uses: diff
  - uses: folder
  - uses: terminal
```

---

### `rules`

List of rules that the LLM should follow. These are inserted into the system message for all chat requests.

Example

```yaml title="config.yaml"
rules:
  - Always annotate Python functions with their parameter and return types
  - Always write Google style docstrings for functions and classes
```

---

### `prompts`

A list of custom prompts that can be invoked from the chat window. Each prompt has a name, description, and the actual prompt text.

```yaml title="config.yaml"
prompts:
  - name: check
    description: Check for mistakes in my code
    prompt: |
      Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:
        - Syntax errors
        - Logic errors
        - Security vulnerabilities
```

---

### `docs`

List of documentation sites to index.

**Properties:**

- `name` (**required**): Name of the documentation site, displayed in dropdowns, etc.
- `startUrl` (**required**): Start page for crawling - usually root or intro page for docs
- `rootUrl`: Crawler will only index docs within this domain - pages that contain this URL
- `favicon`: URL for site favicon (default is `/favicon.ico` from `startUrl`).

Example

```yaml title="config.yaml"
docs:
  - name: Continue
    startUrl: https://docs.continue.dev/intro
    rootUrl: https://docs.continue.dev
    favicon: https://docs.continue.dev/favicon.ico
```

---

<!-- ### `tools`

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

--- -->

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
  - name: My MCP Server
    command: uvx
    args:
      - mcp-server-sqlite
      - --db-path
      - /Users/NAME/test.db
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
version: 0.0.1

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

rules:
  - Give concise responses
  - Always assume TypeScript rather than JavaScript

prompts:
  - name: test
    description: Unit test a function
    prompt: |
      Please write a complete suite of unit tests for this function. You should use the Jest testing framework.  The tests should cover all possible edge cases and should be as thorough as possible.  You should also include a description of each test case.

context:
  - uses: diff
  - uses: file
  - uses: codebase
  - uses: code
  - uses: docs
    with:
      startUrl: https://docs.example.com/introduction
      rootUrl: https://docs.example.com
      maxDepth: 3

mcpServers:
  - name: DevServer
    command: npm
    args:
      - run
      - dev
    env:
      PORT: "3000"
```
