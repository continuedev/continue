---
title: Config YAML Reference
description: Reference for the Continue configuration YAML file
keywords: [config, yaml, configuration, customize, customization]
---

# config.yaml Reference

## Introduction

Continue hub assistants are defined using the `config.yaml` specification. Assistants can be loaded from [the Hub](https://hub.continue.dev/explore/assistants) or locally

- [Continue Hub](https://hub.continue.dev/explore/assistants) - YAML is stored on the hub and automatically synced to the extension
- Locally
  - in your global `.continue` folder (`~/.continue` on Mac, `%USERPROFILE%\.continue`) within `.continue/assistants`. The name of the file will be used as the display name of the assistant, e.g. `My Assistant.yaml`
  - in your workspace in a `/.continue/assistants` folder, with the same naming convention

:::info
Config YAML replaces [`config.json`](./json-reference.md), which is deprecated. View the **[Migration Guide](./yaml-migration.md)**.
:::

An assistant is made up of:

1. **Top level properties**, which specify the `name`, `version`, and `config.yaml` `schema` for the assistant
2. **Block lists**, which are composable arrays of coding assistant building blocks available to the assistant, such as models, docs, and context providers.

A block is a single standalone building block of a coding assistants, e.g., one model or one documentation source. In `config.yaml` syntax, a block consists of the same top-level properties as assistants (`name`, `version`, and `schema`), but only has **ONE** item under whichever block type it is.

Examples of blocks and assistants can be found on the [Continue hub](https://hub.continue.dev/explore/assistants).

Assistants can either explicitly define blocks - see [Properties](#properties) below - or import and configure existing hub blocks.

### Using Blocks

Hub blocks and assistants are identified with a slug in the format `owner-slug/block-or-assistant-slug`, where an owner can be a user or organization.

Blocks can be imported into an assistant by adding a `uses` clause under the block type. This can be alongside other `uses` clauses or explicit blocks of that type.

:::info
Note that local assistants cannot use blocks that require organization-level secrets.
:::

For example, the following assistant imports an Anthropic model and defines an Ollama DeepSeek one.

```yaml title="Assistant models section"
models:
  - uses: anthropic/claude-3.5-sonnet # an imported model block
  - model: deepseek-reasoner # an explicit model block
    provider: ollama
```

### Local Blocks

It is also possible to define blocks locally in a `.continue` folder. This folder can be located at either the root of your workspace (these will automatically be applied to all assistants when you are in that workspace) or in your home directory at `~/.continue` (these will automatically be applied globally).

Place your YAML files in the following folders:

Assistants:

- `.continue/assistants` - for assistants

Blocks:

- `.continue/rules` - for rules
- `.continue/models` - for models
- `.continue/prompts` - for prompts
- `.continue/context` - for context providers
- `.continue/docs` - for docs
- `.continue/data` - for data
- `.continue/mcpServers` - for MCP Servers

You can find many examples of each of these block types on the [Continue Explore Page](https://hub.continue.dev/explore/models)

### Inputs

Blocks can be passed user inputs, including hub secrets and raw text values. To create a block that has an input, use mustache templating as follows:

```yaml title="Block config.yaml"
name: myprofile/custom-model
models:
  - name: My Favorite Model
    provider: anthropic
    apiKey: ${{ inputs.ANTHROPIC_API_KEY }}
    defaultCompletionOptions:
      temperature: ${{ inputs.TEMP }}
```

Which can then be imported like

```yaml title="Assistant config.yaml"
name: myprofile/custom-assistant
models:
  - uses: myprofile/custom-model
    with:
      ANTHROPIC_API_KEY: ${{ secrets.MY_ANTHROPIC_API_KEY }}
      TEMP: 0.9
```

Note that hub secrets can be passed as inputs, using the a similar mustache format: `secrets.SECRET_NAME`.

### Overrides

Block properties can be also be directly overriden using `override`. For example:

```yaml title="Assistant config.yaml"
name: myprofile/custom-assistant
models:
  - uses: myprofile/custom-model
    with:
      ANTHROPIC_API_KEY: ${{ secrets.MY_ANTHROPIC_API_KEY }}
      TEMP: 0.9
    override:
      roles:
        - chat
```

## Properties

Below are details for each property that can be set in `config.yaml`.

**All properties at all levels are optional unless explicitly marked as required.**

The top-level properties in the `config.yaml` configuration file are:

- [`name`](#name) (**required**)
- [`version`](#version) (**required**)
- [`schema`](#schema) (**required**)
- [`models`](#models)
- [`context`](#context)
- [`rules`](#rules)
- [`prompts`](#prompts)
- [`docs`](#docs)
- [`mcpServers`](#mcpservers)
- [`data`](#data)

---

### `name`

The `name` property specifies the name of your project or configuration.

```yaml title="config.yaml"
name: MyProject
```

---

### `version`

The `version` property specifies the version of your project or configuration.

### `schema`

The `schema` property specifies the schema version used for the `config.yaml`, e.g. `v1`

---

### `models`

The `models` section defines the language models used in your configuration. Models are used for functionalities such as chat, editing, and summarizing.

**Properties:**

- `name` (**required**): A unique name to identify the model within your configuration.
- `provider` (**required**): The provider of the model (e.g., `openai`, `ollama`).
- `model` (**required**): The specific model name (e.g., `gpt-4`, `starcoder`).
- `apiBase`: Can be used to override the default API base that is specified per model
- `roles`: An array specifying the roles this model can fulfill, such as `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize`. The default value is `[chat, edit, apply, summarize]`. Note that the `summarize` role is not currently used.
- `capabilities`: Array of strings denoting model capabilities, which will overwrite Continue's autodetection based on provider and model. Supported capabilities include `tool_use` and `image_input`.
- `promptTemplates`: Can be used to override the default prompt templates for different model roles. Valid values are [`edit`](./customize/model-roles/edit.mdx#prompt-templating) and [`apply`](./customize/model-roles/apply.mdx#prompt-templating).
- `chatOptions`: If the model includes role `chat`, these settings apply for Chat and Agent mode:
  - `baseSystemMessage`: Can be used to override the default system prompt.
- `embedOptions`: If the model includes role `embed`, these settings apply for embeddings:
  - `maxChunkSize`: Maximum tokens per document chunk. Minimum is 128 tokens.
  - `maxBatchSize`: Maximum number of chunks per request. Minimum is 1 chunk.
- `defaultCompletionOptions`: Default completion options for model settings.
  - `contextLength`: Maximum context length of the model, typically in tokens.
  - `maxTokens`: Maximum number of tokens to generate in a completion.
  - `temperature`: Controls the randomness of the completion. Values range from `0.0` (deterministic) to `1.0` (random).
  - `topP`: The cumulative probability for nucleus sampling.
  - `topK`: Maximum number of tokens considered at each step.
  - `stop`: An array of stop tokens that will terminate the completion.
  - `n`: Number of completions to generate.
- `requestOptions`: HTTP request options specific to the model.
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

#### Example

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

  - name: My Model - OpenAI-Compatible
    provider: openai
    apiBase: http://my-endpoint/v1
    model: my-custom-model
    capabilities:
      - tool_use
      - image_input
    roles:
      - chat
      - edit
```

---

### `context`

The `context` section defines context providers, which supply additional information or context to the language models. Each context provider can be configured with specific parameters.

More information about usage/params for each context provider can be found [here](/customize/context-providers.mdx)

**Properties:**

- `provider` (**required**): The identifier or name of the context provider (e.g., `code`, `docs`, `web`)
- `name`: Optional name for the provider
- `params`: Optional parameters to configure the context provider's behavior.

**Example:**

```yaml title="config.yaml"
context:
  - provider: file
  - provider: code
  - provider: codebase
    params:
      nFinal: 10
  - provider: docs
  - provider: diff
  - provider: http
    name: Context Server 1
    params:
      url: "https://api.example.com/server1"
  - provider: folder
  - provider: terminal
```

---

### `rules`

List of rules that the LLM should follow. These are concatenated into the system message for all [Chat](./chat/how-to-use-it.md), [Edit](./edit/how-to-use-it.md), and [Agent](./agent/how-to-use-it.md) requests. See the [rules deep dive](./customize/deep-dives/rules.md) for details.

Explicit rules can either be simple text or an object with the following properties:

- `name` (**required**): A display name/title for the rule
- `rule` (**required**): The text content of the rule
<!-- `if` -->

Example

```yaml title="config.yaml"
rules:
  - uses: myprofile/my-mood-setter
    with:
      TONE: concise
  - Always annotate Python functions with their parameter and return types
  - Always write Google style docstrings for functions and classes
  - name: Server-side components
    rule: When writing Next.js React components, use server-side components where possible instead of client components.
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
<!-- - `rootUrl`: Crawler will only index docs within this domain - pages that contain this URL -->
- `maxDepth`: Maximum link depth for crawling. Default `4`
- `favicon`: URL for site favicon (default is `/favicon.ico` from `startUrl`).
- `useLocalCrawling`: Skip the default crawler and only crawl using a local crawler.

Example

```yaml title="config.yaml"
docs:
  - name: Continue
    startUrl: https://docs.continue.dev/intro
    favicon: https://docs.continue.dev/favicon.ico
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
  - name: My MCP Server
    command: uvx
    args:
      - mcp-server-sqlite
      - --db-path
      - /Users/NAME/test.db
```

### `data`

Destinations to which [development data](./customize/deep-dives/development-data.md) will be sent.

**Properties:**

- `name` (**required**): The display name of the data destination
- `destination` (**required**): The destination/endpoint that will receive the data. Can be:
  - an HTTP endpoint that will receive a POST request with a JSON blob
  - a file URL to a directory in which events will be dumpted to `.jsonl` files
- `schema` (**required**): the schema version of the JSON blobs to be sent
- `events`: an array of event names to include. Defaults to all events if not specified.
- `level`: a pre-defined filter for event fields. Options include `all` and `noCode`; the latter excludes data like file contents, prompts, and completions. Defaults to `all`
- `apiKey`: api key to be sent with request (Bearer header)
- `requestOptions`: Options for event POST requests. Same format as [model requestOptions](#models).

  **Example:**

```yaml title="config.yaml"
data:
  - name: Local Data Bank
    destination: file:///Users/dallin/Documents/code/continuedev/continue-extras/external-data
    schema: 0.2.0
    level: all
  - name: My Private Company
    destination: https://mycompany.com/ingest
    schema: 0.2.0
    level: noCode
    events:
      - autocomplete
      - chatInteraction
```

---

## Complete YAML Config Example

Putting it all together, here's a complete example of a `config.yaml` configuration file:

```yaml title="config.yaml"
name: MyProject
version: 0.0.1
schema: v1

models:
  - uses: anthropic/claude-3.5-sonnet
    with:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    override:
      defaultCompletionOptions:
        temperature: 0.8
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
  - uses: myprofile/my-favorite-prompt

context:
  - provider: diff
  - provider: file
  - provider: codebase
  - provider: code
  - provider: docs
    params:
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

data:
  - name: My Private Company
    destination: https://mycompany.com/ingest
    schema: 0.2.0
    level: noCode
    events:
      - autocomplete
      - chatInteraction
```

## Using YAML anchors to avoid config duplication

You can also use node anchors to avoid duplication of properties. To do so,
adding the YAML version header `%YAML 1.1` is needed, here's an example of
a `config.yaml` configuration file using anchors:

```yaml title="config.yaml"
%YAML 1.1
---
name: MyProject
version: 0.0.1
schema: v1

model_defaults: &model_defaults
  provider: openai
  apiKey: my-api-key
  apiBase: https://api.example.com/llm

models:
  - name: mistral
    <<: *model_defaults
    model: mistral-7b-instruct
    roles:
      - chat
      - edit

  - name: qwen2.5-coder-7b-instruct
    <<: *model_defaults
    model: qwen2.5-coder-7b-instruct
    roles:
      - chat
      - edit

  - name: qwen2.5-coder-7b
    <<: *model_defaults
    model: qwen2.5-coder-7b
    env:
      useLegacyCompletionsEndpoint: false
    roles:
      - autocomplete
```
