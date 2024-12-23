---
title: config.json Reference
description: Reference for the Continue _config.json_ configuration file
keywords: [config, config_schema.json, json]
---

Below are details for each property that can be set in `config.json`. The config schema code is found in [`extensions/vscode/config_schema.json`](https://github.com/continuedev/continue/blob/main/extensions/vscode/config_schema.json).

**All properties at all levels are optional unless explicitly marked required**

### `models`

Your **chat** models are defined here, which are used for [Chat](./chat/how-to-use-it.md), [Edit](./edit/how-to-use-it.md), and [Actions](./actions/how-to-use-it.md).
Each model has specific configuration options tailored to its provider and functionality, which can be seen as suggestions while editing the json.

**Properties:**

- `title` (**required**): The title to assign to your model, shown in dropdowns, etc.
- `provider` (**required**): The provider of the model, which determines the type and interaction method. Options inclued `openai`, `ollama`, etc., see intelliJ suggestions.
- `model` (**required**): The name of the model, used for prompt template auto-detection. Use `AUTODETECT` special name to get all available models.
- `apiKey`: API key required by providers like OpenAI, Anthropic, and Cohere.
- `apiBase`: The base URL of the LLM API.
- `contextLength`: Maximum context length of the model, typically in tokens (default: 2048).
- `maxStopWords`: Maximum number of stop words allowed, to avoid API errors with extensive lists.
- `template`: Chat template to format messages. Auto-detected for most models but can be overridden. See intelliJ suggestions.
- `promptTemplates`: A mapping of prompt template names (e.g., `edit`) to template strings. [Customization Guide](https://docs.continue.dev/model-setup/configuration#customizing-the-edit-prompt).
- `completionOptions`: Model-specific completion options, same format as top-level [`completionOptions`](#completionoptions), which they override.
- `systemMessage`: A system message that will precede responses from the LLM.
- `requestOptions`: Model-specific HTTP request options, same format as top-level [`requestOptions`](#requestoptions), which they override.
- `apiType`: Specifies the type of API (`openai` or `azure`).
- `apiVersion`: Azure API version (e.g., `2023-07-01-preview`).
- `engine`: Engine for Azure OpenAI requests.
- `capabilities`: Override auto-detected capabilities:
  - `uploadImage`: Boolean indicating if the model supports image uploads.

_(AWS Only)_

- `profile`: AWS security profile for authorization.
- `modelArn`: AWS ARN for imported models (e.g., for `bedrockimport` provider).
- `region`: Region where the model is hosted (e.g., `us-east-1`, `eu-central-1`).

Example:

```json title="config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "AUTODETECT"
    },
    {
      "model": "gpt-4o",
      "contextLength": 128000,
      "title": "GPT-4o",
      "provider": "openai",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

### `tabAutocompleteModel`

Specifies the model or models for tab autocompletion, defaulting to an Ollama instance. This property uses the same format as `models`. Can be an array of models or an object for one model.

Example

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "My Starcoder",
    "provider": "ollama",
    "model": "starcoder2:3b"
  }
}
```

### `tabAutocompleteOptions`

Specifies options for tab autocompletion behavior.

**Properties:**

- `disable`: If `true`, disables tab autocomplete (default: `false`).
- `useFileSuffix`: If `true`, includes file suffix in the prompt.
- `maxPromptTokens`: Maximum number of tokens for the prompt.
- `debounceDelay`: Delay (in ms) before triggering autocomplete.
- `maxSuffixPercentage`: Maximum percentage of prompt for suffix.
- `prefixPercentage`: Percentage of input for prefix.
- `template`: Template string for autocomplete, using Mustache templating.
- `multilineCompletions`: Controls multiline completions (`"always"`, `"never"`, or `"auto"`).
- `useCache`: If `true`, caches completions.
- `onlyMyCode`: If `true`, only includes code within the repository.
- `disableInFiles`: Array of glob patterns for files where autocomplete is disabled.

Example

```json title="config.json"
{
  "tabAutocompleteOptions": {
    "debounceDelay": 500,
    "maxPromptTokens": 1500,
    "disableInFiles": ["*.md"]
  }
}
```

### `embeddingsProvider`

Embeddings model settings - the model used for @Codebase and @docs.

**Properties:**

- `provider` (**required**): Specifies the embeddings provider, with options including `transformers.js`, `ollama`, `openai`, `cohere`, `free-trial`, `gemini`, etc
- `model`: Model name for embeddings.
- `apiKey`: API key for the provider.
- `apiBase`: Base URL for API requests.
- `requestOptions`: Additional HTTP request settings specific to the embeddings provider.
- `maxChunkSize`: Maximum tokens per document chunk. Minimum is 128 tokens.
- `maxBatchSize`: Maximum number of chunks per request. Minimum is 1 chunk.

(AWS ONLY)

- `region`: Specifies the region hosting the model.
- `profile`: AWS security profile.

Example:

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiKey": "<API_KEY>",
    "maxChunkSize": 256,
    "maxBatchSize": 5
  }
}
```

### `completionOptions`

Parameters that control the behavior of text generation and completion settings. Top-level `completionOptions` apply to all models, _unless overridden at the model level_.

**Properties:**

- `stream`: Whether to stream the LLM response. Currently only respected by the `anthropic` and `ollama` providers; other providers will always stream (default: `true`).
- `temperature`: Controls the randomness of the completion. Higher values result in more diverse outputs.
- `topP`: The cumulative probability for nucleus sampling. Lower values limit responses to tokens within the top probability mass.
- `topK`: The maximum number of tokens considered at each step. Limits the generated text to tokens within this probability.
- `presencePenalty`: Discourages the model from generating tokens that have already appeared in the output.
- `frequencePenalty`: Penalizes tokens based on their frequency in the text, reducing repetition.
- `mirostat`: Enables Mirostat sampling, which controls the perplexity during text generation. Supported by Ollama, LM Studio, and llama.cpp providers (default: `0`, where `0` = disabled, `1` = Mirostat, and `2` = Mirostat 2.0).
- `stop`: An array of stop tokens that, when encountered, will terminate the completion. Allows specifying multiple end conditions.
- `maxTokens`: The maximum number of tokens to generate in a completion (default: `2048`).
- `numThreads`: The number of threads used during the generation process. Available only for Ollama as `num_thread`.
- `keepAlive`: For Ollama, this parameter sets the number of seconds to keep the model loaded after the last request, unloading it from memory if inactive (default: `1800` seconds, or 30 minutes).
- `useMmap`: For Ollama, this parameter allows the model to be mapped into memory. If disabled can enhance response time on low end devices but will slow down the stream.

Example

```json title="config.json"
{
  "completionOptions": {
    "stream": false,
    "temperature": 0.5
  }
}
```

### `requestOptions`

Default HTTP request options that apply to all models and context providers, unless overridden at the model level.

**Properties:**

- `timeout`: Timeout for each request to the LLM (default: 7200 seconds).
- `verifySsl`: Whether to verify SSL certificates for requests.
- `caBundlePath`: Path to a custom CA bundle for HTTP requests - path to `.pem` file (or array of paths)
- `proxy`: Proxy URL to use for HTTP requests.
- `headers`: Custom headers for HTTP requests.
- `extraBodyProperties`: Additional properties to merge with the HTTP request body.
- `noProxy`: List of hostnames that should bypass the specified proxy.
- `clientCertificate`: Client certificate for HTTP requests.

  - `cert`: Path to the client certificate file.
  - `key`: Path to the client certificate key file.
  - `passphrase`: Optional passphrase for the client certificate key file.

Example

```json title="config.json"
{
  "requestOptions": {
    "headers": {
      "X-Auth-Token": "xxx"
    }
  }
}
```

### `reranker`

Configuration for the reranker model used in response ranking.

**Properties:**

- `name` (**required**): Reranker name, e.g., `cohere`, `voyage`, `llm`, `free-trial`, `huggingface-tei`, `bedrock`
- `params`:
  - `model`: Model name
  - `apiKey`: Api key
  - `region`: Region (for Bedrock only)

Example

```json title="config.json"
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-2",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

### `docs`

List of documentation sites to index.

**Properties:**

- `title` (**required**): Title of the documentation site, displayed in dropdowns, etc.
- `startUrl` (**required**): Start page for crawling - usually root or intro page for docs
- `rootUrl`: Crawler will only index docs within this domain - pages that contain this URL
- `maxDepth`: Maximum depth for crawling. Default `3`
- `favicon`: URL for site favicon (default is `/favicon.ico` from `startUrl`).

Example

```json title="config.json"
"docs": [
    {
    "title": "Continue",
    "startUrl": "https://docs.continue.dev/intro",
    "rootUrl": "https://docs.continue.dev",
    "faviconUrl": "https://docs.continue.dev/favicon.ico",
  }
]
```

### `analytics`

Configuration for analytics tracking.

**Properties:**

- `provider`: Analytics provider (`"posthog"` or `"logstash"`).
- `url`: URL for analytics data.
- `clientKey`: Client key for analytics.

### `slashCommands`

Custom commands initiated by typing "/" in the sidebar. Commands include predefined functionality or may be user-defined.

**Properties:**

- `name`: The command name. Options include "issue", "share", "cmd", "http", "commit", and "review".
- `description`: Brief description of the command.
- `step`: (Deprecated) Used for built-in commands; set the name for pre-configured options.
- `params`: Additional parameters to configure command behavior (command-specific - see code for command)

Example:

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "commit",
      "description": "Generate a commit message"
    },
    {
      "name": "share",
      "description": "Export this session as markdown"
    },
    {
      "name": "cmd",
      "description": "Generate a shell command"
    }
  ]
}
```

### `customCommands`

User-defined commands for prompt shortcuts in the sidebar, allowing quick access to common actions.

**Properties:**

- `name`: The name of the custom command.
- `prompt`: Text prompt for the command.
- `description`: Brief description explaining the command's function.

Example:

```json title="config.json"
{
  "customCommands": [
    {
      "name": "test",
      "prompt": "Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ]
}
```

### `contextProviders`

List of the pre-defined context providers that will show up as options while typing in the chat, and their customization with `params`.

**Properties:**

- `name`: Name of the context provider, e.g. `docs` or `web`
- `params`: A context-provider-specific record of params to configure the context behavior

Example

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "code",
      "params": {}
    },
    {
      "name": "docs",
      "params": {}
    },
    {
      "name": "diff",
      "params": {}
    },
    {
      "name": "open",
      "params": {}
    }
  ]
}
```

### `disableSessionTitles`

Prevents generating summary titles for each chat session when set to `true`.

### `ui`

Customizable UI settings to control interface appearance and behavior.

**Properties:**

- `codeBlockToolbarPosition`: Sets the toolbar position within code blocks, either `top` (default) or `bottom`.
- `fontSize`: Specifies font size for UI elements.
- `displayRawMarkdown`: If `true`, shows raw markdown in responses.
- `showChatScrollbar`: If `true`, enables a scrollbar in the chat window.
- `codeWrap`: If `true`, enables text wrapping in code blocks.

Example:

```json title="config.json"
{
  "ui": {
    "codeBlockToolbarPosition": "bottom",
    "fontSize": 14,
    "displayRawMarkdown": false,
    "showChatScrollbar": false,
    "codeWrap": false
  }
}
```

### `allowAnonymousTelemetry`

When `true`, anonymous usage data is collected using Posthog, to improve features. Default is `true`.

### `userToken`

An optional token that identifies the user, primarily for authenticated services.

### `systemMessage`

Defines a system message that appears before every response from the language model, providing guidance or context.

### `disableIndexing`

Prevents indexing of the codebase, useful primarily for debugging purposes.

### `experimental`

Several experimental config parameters are available, as described below:

`experimental`:

- `defaultContext`: Defines the default context for the LLM. Uses the same format as `contextProviders` but includes an additional `query` property to specify custom query parameters.=
- `modelRoles`:
  - `inlineEdit`: Model title for inline edits.
  - `applyCodeBlock`: Model title for applying code blocks.
  - `repoMapFileSelection`: Model title for repo map selections.
- `readResponseTTS`: If `true`, reads LLM responses aloud with TTS. Default is `true`.
- `promptPath`: Change the path to custom prompt files from the default ".prompts"
- `quickActions`: Array of custom quick actions
  - `title` (**required**): Display title for the quick action.
  - `prompt` (**required**): Prompt for quick action.
  - `sendToChat`: If `true`, sends result to chat; else inserts in document. Default is `false`.
- `contextMenuPrompts`:
  - `comment`: Prompt for commenting code.
  - `docstring`: Prompt for adding docstrings.
  - `fix`: Prompt for fixing code.
  - `optimize`: Prompt for optimizing code.
  - `fixGrammar`: Prompt for fixing grammar or spelling.
- `useChromiumForDocsCrawling`: Use Chromium to crawl docs locally. Useful if the default Cheerio crawler fails on sites that require JavaScript rendering. Downloads and installs Chromium to `~/.continue/.utils`..

Example

```json title="config.json"
{
  "experimental": {
    "modelRoles": {
      "inlineEdit": "Edit Model"
    },
    "promptPath": "custom/.prompts",
    "quickActions": [
      {
        "title": "Tags",
        "prompt": "Return a list of any function and class names from the included code block",
        "sendToChat": true
      }
    ],
    "contextMenuPrompts": {
      "fixGrammar": "Fix grammar in the above but allow for typos."
    },
    "readResponseTTS": false,
    "useChromiumForDocsCrawling": true
  }
}
```
