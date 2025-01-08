---
title: Config YAML Reference
description: Reference for the Continue configuration YAML file (v2)
keywords: [config, yaml]
---

# Config YAML Reference (v2)

Below are details for each property that can be set in `continue.yaml`. This reference corresponds to the updated and simplified schemas for version 2 of the configuration file format.

**All properties at all levels are optional unless explicitly marked as required.**

## Top-Level Properties

The top-level properties in the `continue.yaml` configuration file are:

- [`name`](#name) (**required**)
- [`packages`](#packages)
- [`models`](#models)
- [`context`](#context)
- [`data`](#data)
- [`tools`](#tools)
- [`mcpServers`](#mcpservers)

---

### `name`

The `name` property specifies the name of your project or configuration.

```yaml
# continue.yaml
name: MyProject
```

---

<!--
### `packages`

The `packages` section specifies the packages used in your configuration. Each package can include configuration options.

**Properties:**

- `uses` (**required**): The identifier or path of the package to use.
- `with`: Optional configuration options for the package.

**Example:**

```yaml
# continue.yaml
packages:
  - uses: continue/llm-package
    with:
      model: gpt-4
```

--- -->

### `models`

The `models` section defines the language models used in your configuration. Each model can have specific roles and options.

**Properties:**

- `name` (**required**): A unique name to identify the model within your configuration.
- `provider` (**required**): The provider of the model (e.g., `openai`, `ollama`).
- `model` (**required**): The specific model name (e.g., `gpt-4`, `starcoder`).
- `roles`: An array specifying the roles this model can fulfill. Possible roles are `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize`.
- `defaultCompletionOptions`: Default completion options for the model. See [`defaultCompletionOptions`](#defaultcompletionoptions) for more details.
- `requestOptions`: HTTP request options specific to the model. See [`requestOptions`](#requestoptions) for more details.

#### `defaultCompletionOptions`

Parameters that control the behavior of text generation and completion settings.

**Properties:**

- `contextLength`: Maximum context length of the model, typically in tokens.
- `maxTokens`: The maximum number of tokens to generate in a completion (default: `2048`).
- `temperature`: Controls the randomness of the completion. Higher values result in more diverse outputs.
- `topP`: The cumulative probability for nucleus sampling. Lower values limit responses to tokens within the top probability mass.
- `topK`: The maximum number of tokens considered at each step. Limits the generated text to tokens within this probability.
- `stop`: An array of stop tokens that, when encountered, will terminate the completion.
- `n`: Generates `n` completions.

#### `requestOptions`

Default HTTP request options that apply to the model.

**Properties:**

- `timeout`: Timeout for each request to the language model (default: `7200` seconds).
- `verifySsl`: Whether to verify SSL certificates for requests.
- `caBundlePath`: Path to a custom CA bundle for HTTP requests (path to `.pem` file or an array of paths).
- `proxy`: Proxy URL to use for HTTP requests.
- `headers`: Custom headers for HTTP requests.
- `extraBodyProperties`: Additional properties to merge with the HTTP request body.
- `noProxy`: List of hostnames that should bypass the specified proxy.
- `clientCertificate`: Client certificate for HTTP requests.

  - `cert`: Path to the client certificate file.
  - `key`: Path to the client certificate key file.
  - `passphrase`: Optional passphrase for the client certificate key file.

#### Example:

```yaml
# continue.yaml
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
        Authorization: Bearer YOUR_API_KEY
  - name: Ollama Starcoder
    provider: ollama
    model: starcoder
    roles:
      - autocomplete
    defaultCompletionOptions:
      temperature: 0.3
      stop:
        - "\n"
```

---

### `context`

The `context` section defines context providers, which supply additional information or context to the language models. Each context provider can be configured with specific parameters.

**Properties:**

- `uses` (**required**): The identifier or name of the context provider (e.g., `code`, `docs`, `web`).
- `with`: Optional parameters to configure the context provider's behavior.

**Example:**

```yaml
# continue.yaml
context:
  - uses: code
    with:
      includePaths:
        - src/
        - lib/
      excludePaths:
        - tests/
  - uses: docs
    with:
      startUrl: https://docs.continue.dev/intro
      rootUrl: https://docs.continue.dev
      maxDepth: 3
```

---

### `data`

The `data` section specifies data providers used in your configuration. Data providers supply data or resources for use in various operations.

**Properties:**

- `provider` (**required**): The name of the data provider.

**Example:**

```yaml
# continue.yaml
data:
  - provider: embeddings
```

---

### `tools`

The `tools` section specifies external tools or APIs that can be used within your configuration.

**Properties:**

- `url` (**required**): The URL of the tool's API or endpoint.
- `apiKey`: An optional API key required by the tool.

**Example:**

```yaml
# continue.yaml
tools:
  - url: https://api.exampletool.com
    apiKey: YOUR_API_KEY
```

---

### `mcpServers`

The `mcpServers` section defines Multi-Client Process (MCP) servers used in your configuration. MCP servers can run background processes or services.

**Properties:**

- `name` (**required**): The name of the MCP server.
- `command` (**required**): The command used to start the server.
- `args`: An optional array of arguments for the command.
- `env`: An optional map of environment variables for the server process.

**Example:**

```yaml
# continue.yaml
mcpServers:
  - name: DevelopmentServer
    command: npm
    args:
      - run
      - dev
    env:
      PORT: "3000"
```

---

## In-Depth Property Descriptions

Below are detailed descriptions of key properties, reusing definitions from version 1 where applicable.

### `models`

Your language models are defined in the `models` section. Models are used for various functionalities such as chat, editing, and actions.

#### **Properties:**

- `name` (**required**): A unique name to identify the model within your configuration.
- `provider` (**required**): The provider of the model, which determines the type and interaction method. Options include `openai`, `ollama`, etc.
- `model` (**required**): The specific model name (e.g., `gpt-4`, `starcoder`).
- `roles`: An array specifying the roles this model can fulfill. Possible roles are:

  - `chat`: Used for chat interactions.
  - `autocomplete`: Used for tab autocompletion.
  - `embed`: Used for generating embeddings.
  - `rerank`: Used for reranking responses.
  - `edit`: Used for code or text editing tasks.
  - `apply`: Used for applying code changes.
  - `summarize`: Used for summarizing content.

- `defaultCompletionOptions`: Default completion options for the model.

  For properties and examples, see the [Default Completion Options](#defaultcompletionoptions) section.

- `requestOptions`: HTTP request options specific to the model.

  For properties and examples, see the [Request Options](#requestoptions) section.

#### **Example:**

```yaml
# continue.yaml
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

### `defaultCompletionOptions`

Parameters that control the behavior of text generation and completion settings for models.

**Properties:**

- `contextLength`: Maximum context length of the model, typically in tokens.
- `maxTokens`: The maximum number of tokens to generate in a completion (default: `2048`).
- `temperature`: Controls the randomness of the completion. Higher values result in more diverse outputs.

  - **Range:** `0.0` (deterministic) to `1.0` (more random)
  - **Default:** `0.7`

- `topP`: The cumulative probability for nucleus sampling. Tokens are considered from the top until the cumulative probability exceeds this value.

  - **Range:** `0.0` to `1.0`
  - **Default:** `1.0`

- `topK`: The maximum number of tokens considered at each step.

  - **Default:** model-specific

- `stop`: An array of stop tokens that, when encountered, will terminate the completion.
- `n`: Number of completions to generate.

#### **Example:**

```yaml
# continue.yaml
models:
  - name: GPT-3.5 Turbo
    provider: openai
    model: gpt-3.5-turbo
    defaultCompletionOptions:
      temperature: 0.7
      maxTokens: 1500
      topP: 0.95
      stop:
        - "\n\n"
      n: 1
```

---

### `requestOptions`

Default HTTP request options that apply to models and context providers.

**Properties:**

- `timeout`: Timeout in seconds for each request to the language model (default: `7200` seconds).
- `verifySsl`: Whether to verify SSL certificates for requests.

  - **Default:** `true`

- `caBundlePath`: Path to a custom CA bundle for HTTP requests. Can be a string or an array of paths.
- `proxy`: Proxy URL to use for HTTP requests.
- `headers`: Custom headers for HTTP requests.

  - **Example:**

    ```yaml
    headers:
      X-Custom-Header: "CustomValue"
    ```

- `extraBodyProperties`: Additional properties to merge with the HTTP request body.
- `noProxy`: List of hostnames that should bypass the specified proxy.
- `clientCertificate`: Client certificate for HTTP requests.

  - **Properties:**
    - `cert`: Path to the client certificate file.
    - `key`: Path to the client certificate key file.
    - `passphrase`: Optional passphrase for the client certificate key file.

#### **Example:**

```yaml
# continue.yaml
models:
  - name: SecureModel
    provider: secureapi
    model: secure-model-v1
    requestOptions:
      timeout: 5000
      verifySsl: true
      caBundlePath: /path/to/ca_bundle.pem
      proxy: http://proxy.example.com:8080
      headers:
        Authorization: Bearer YOUR_SECURE_API_KEY
      clientCertificate:
        cert: /path/to/client_cert.pem
        key: /path/to/client_key.pem
        passphrase: your_passphrase
```

---

### `context`

Your context providers are defined in the `context` section. They supply additional information or context to the language models.

#### **Properties:**

- `uses` (**required**): The name of the context provider, e.g., `code`, `docs`, `web`.
- `with`: An optional map of parameters to configure the context provider's behavior.

#### **Example:**

```yaml
# continue.yaml
context:
  - uses: code
    with:
      includePaths:
        - src/
        - lib/
      excludePaths:
        - test/
  - uses: docs
    with:
      startUrl: https://docs.example.com/start
      rootUrl: https://docs.example.com
      maxDepth: 2
```

---

### `data`

Defines data providers used in your configuration.

**Properties:**

- `provider` (**required**): The name of the data provider.

#### **Example:**

```yaml
# continue.yaml
data:
  - provider: embeddings
  - provider: other-data-source
```

---

## Complete Configuration Example

Putting it all together, here's a complete example of a `continue.yaml` configuration file:

```yaml
# continue.yaml
name: MyProject

packages:
  - uses: continue/llm-package
    with:
      model: gpt-4

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
  - uses: code
    with:
      includePaths:
        - src/
        - lib/
      excludePaths:
        - test/
  - uses: docs
    with:
      startUrl: https://docs.example.com/introduction
      rootUrl: https://docs.example.com
      maxDepth: 3

data:
  - provider: embeddings

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

---

## Notes

- **Property Naming Conventions:** In YAML, properties use lowercase letters and hyphens (`-`) to separate words (e.g., `max-tokens`). However, in this configuration, we use camelCase to match the schemas (e.g., `maxTokens`).
- **Required Properties:** Properties marked as **required** must be provided in your configuration.

- **Optional Properties:** All properties not marked as required are optional.

- **Extensibility:** The configuration format is designed to be extensible, allowing for future additions and custom configurations.

---

## Conclusion

This reference provides an overview of the configuration options available in the version 2 YAML configuration file format. By structuring your `continue.yaml` file according to this reference, you can customize your environment to suit your specific needs.

For more examples and advanced configurations, please refer to the official Continue documentation and GitHub repository.
