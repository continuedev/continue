---
title: Continue Configuration
description: Continue configuration files
keywords: [config, config_schema.json, json]
sidebar_position: 2
---

# Continue Config

Continue can be deeply customized. User-level configuration is stored and can be edited in your home directory in [`config.json`](#configjson):

- `~/.continue/config.json` (MacOS / Linux)
- `%USERPROFILE%\.continue\config.json` (Windows)

To open `config.json`, you can click the "gear" icon in the bottom right corner of the Continue Chat sidebar. When editing this file, you can use IntelliSense to see the available options as you type, or check the reference below.

When you save `config.json`, Continue will automatically refresh to take into account your changes. `config.json` is automatically created the first time you use Continue.

In the vast majority of cases, you will only need to edit `config.json`. However, Continue offers two additional ways to customize configuration:

- [`.continuerc.json`](#continuercjson) - Workspace-level configuration. If you'd like to scope certain settings to a particular workspace, you can add a `.continuerc.json` to the root of your project. This can be set to merge with _or_ override the user-level `config.json`
- [`config.ts`](#config-ts) - Advanced configuration (probably unnecessary) - a TypeScript file in your home directory that can be used to programmatically modify (_merged_) the `config.json` schema:
  - `~/.continue/config.ts` (MacOS / Linux)
  - `%USERPROFILE%\.continue\config.ts` (Windows)

## `config.json`

Below are details for each property that can be set in `config.json`. The config schema code is found in [`extensions/vscode/config_schema.json`](https://github.com/continuedev/continue/blob/main/extensions/vscode/config_schema.json).

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
- `maxTokens`: The maximum number of tokens to generate in a completion (default: `600`).
- `numThreads`: The number of threads used during the generation process. Available only for Ollama as `num_thread`.
- `keepAlive`: For Ollama, this parameter sets the number of seconds to keep the model loaded after the last request, unloading it from memory if inactive (default: `1800` seconds, or 30 minutes).

### `requestOptions`

Default HTTP request options that apply to all models and context providers, unless overridden at the model level.

**Properties:**

- `timeout`: Timeout for each request to the LLM (default: 7200 seconds).
- `verifySsl`: Whether to verify SSL certificates for requests.
- `caBundlePath`: Path to a custom CA bundle for HTTP requests.
- `proxy`: Proxy URL to use for HTTP requests.
- `headers`: Custom headers for HTTP requests.
- `extraBodyProperties`: Additional properties to merge with the HTTP request body.
- `noProxy`: List of hostnames that should bypass the specified proxy.
- `clientCertificate`: Client certificate for HTTP requests.
  - `cert`: Path to the client certificate file.
  - `key`: Path to the client certificate key file.
  - `passphrase`: Optional passphrase for the client certificate key file.

### `models`

Your **chat** models are defined here, which are used for chat, edit, and actions.

**Properties:**

### `models`

Your **chat** models are defined here, which are used for chat, edit, and actions. Each model has specific configuration options tailored to its provider and functionality.

Properties:

- `title`: The title to assign to your model.
- `provider`: The provider of the model, which determines the type and interaction method. Options inclued `openai`, `ollama`, etc., see intelliJ suggestions.
- `model`: The name of the model, used for prompt template auto-detection.
- `apiKey`: API key required by providers like OpenAI, Anthropic, and Cohere.
- `apiBase`: The base URL of the LLM API.
- `region`: Region where the model is hosted (e.g., `us-east-1`, `eu-central-1`).
- `profile`: AWS security profile for authorization.
- `modelArn`: AWS ARN for imported models (e.g., for `bedrockimport` provider).
- `contextLength`: Maximum context length of the model, typically in tokens (default: 2048).
- `maxStopWords`: Maximum number of stop words allowed, to avoid API errors with extensive lists.
- `template`: Chat template to format messages. Auto-detected for most models but can be overridden. See intelliJ suggestions.
- `promptTemplates`: A mapping of prompt template names (e.g., `edit`) to template strings. [Customization Guide](https://docs.continue.dev/model-setup/configuration#customizing-the-edit-prompt).
- `completionOptions`: Model-specific completion options, same format as top-level `completionOptions`, which they override.
- `systemMessage`: A system message that will precede responses from the LLM.
- `requestOptions`: Model-specific HTTP request options, same format as top-level `requestOptions`, which they override.
- `apiType`: Specifies the type of API (`openai` or `azure`).
- `apiVersion`: Azure API version (e.g., `2023-07-01-preview`).
- `engine`: Engine for Azure OpenAI requests.
- `capabilities`: Override auto-detected capabilities, including:
  - `uploadImage`: Boolean indicating if the model supports image uploads.

Example:

````json
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


- `title`: "... I will manually enter these"
- `provider`: ""
- `model`: ""
- `apiKey`: ""
- `apiBase`: ""
- `region`: ""
- `profile`: ""
- `modelArn`: ""
- `contextLength`: ""
- `maxStopWords`: ""
- `template`: ""
- `promptTemplates`: ""
- `completionOptions`: Same format as top-level `completionOptions` - model-specific options overwrite.
- `systemMessage`: ""
- `requestOptions`: Same format as top-level `requestOptions` - model-specific options overwrite.
- `apiType`: ""
- `apiVersion`: ""
- `engine`: ""
- `capabilities`: ""

Example:

```json
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
````

### `tabAutocompleteModel`

Specifies the model or models for tab autocompletion, defaulting to an Ollama instance. This property uses the same format as `models`.

### `experimental.defaultContext`

Defines the default context for the LLM. Uses the same format as `contextProviders` but includes an additional `query` property to specify custom query parameters.

### `tabAutocompleteOptions`

Specifies options for tab autocompletion behavior.

**Properties:**

- `disable`: If `true`, disables tab autocomplete (default: `false`).
- `useCopyBuffer`: If `true`, includes the copy buffer in the prompt.
- `useFileSuffix`: If `true`, includes file suffix in the prompt.
- `maxPromptTokens`: Maximum number of tokens for the prompt.
- `debounceDelay`: Delay (in ms) before triggering autocomplete.
- `maxSuffixPercentage`: Maximum percentage of prompt for suffix.
- `prefixPercentage`: Percentage of input for prefix.
- `template`: Template string for autocomplete, using Mustache templating.
- `multilineCompletions`: Controls multiline completions (`"always"`, `"never"`, or `"auto"`).
- `useCache`: If `true`, caches completions.
- `onlyMyCode`: If `true`, only includes code within the repository.
- `useOtherFiles`: If `true`, includes snippets from other files (default: `true`).
- `disableInFiles`: Array of glob patterns for files where autocomplete is disabled.

### `embeddingsProvider`

Configuration for the embeddings provider used for codebase embeddings.

**Properties:**

- `provider`: The embeddings provider (`"huggingface-tei"`, `"transformers.js"`, `"ollama"`, `"openai"`, `"cohere"`, `"free-trial"`, `"gemini"`, `"voyage"`, `"nvidia"`, `"bedrock"`, `"sagemaker"`, `"vertex"`).
- `model`: Model name for embeddings.
- `apiKey`: API key for the provider.
- `apiBase`: Base URL for API requests.
- `requestOptions`: Same format as `requestOptions` for embeddings provider.
- `maxChunkSize`: Maximum tokens per document chunk (minimum: 128).
- `maxBatchSize`: Maximum chunks per request (minimum: 1).
- `region`: Region where the model is hosted.
- `profile`: AWS security profile.

### `reranker`

Configuration for the reranker used in response ranking.

**Properties:**

- `name`: Reranker name (`"cohere"`, `"voyage"`, `"llm"`, `"free-trial"`, `"huggingface-tei"`).
- `params`: Additional parameters for reranking.

### `contextProviders`

List of context providers for enriching LLM context.

### `docs`

List of documentation sites to index.

**Properties:**

- `title`: Title of the documentation site.
- `startUrl`: Starting URL for indexing.
- `rootUrl`: Optional root URL of the site.
- `maxDepth`: Maximum depth for crawling.
- `favicon`: URL for site favicon (default is `/favicon.ico` from `startUrl`).

### `analytics`

Configuration for analytics tracking.

**Properties:**

- `provider`: Analytics provider (`"posthog"` or `"logstash"`).
- `url`: URL for analytics data.
- `clientKey`: Client key for analytics.

### `experimental.modelRoles`

Model roles used for various tasks.

**Properties:**

- `inlineEdit`: Model title for inline edits.
- `applyCodeBlock`: Model title for applying code blocks.
- `repoMapFileSelection`: Model title for repo map selections.

### `experimental.promptPath`

Path for prompt configuration.

### `experimental.quickActions`

Array of custom quick actions for code lens.

**Properties:**

- `title`: Display title for the quick action.
- `prompt`: Prompt for the quick action.
- `sendToChat`: If `true`, sends result to chat; otherwise, inserts it into the document (default: `false`).

### `experimental.contextMenuPrompts`

Predefined prompts for context menu actions.

**Properties:**

- `comment`: Prompt for commenting code.
- `docstring`: Prompt for adding docstrings.
- `fix`: Prompt for fixing code.
- `optimize`: Prompt for optimizing code.
- `fixGrammar`: Prompt for fixing grammar or spelling.

## `.continuerc.json`

The format of `.continuerc.json` is the same as `config.json`, plus one _additional_ property `mergeBehavior`, which can be set to either "merge" or "overwrite". If set to "merge" (the default), `.continuerc.json` will be applied on top of `config.json` (arrays and objects are merged). If set to "overwrite", then every top-level property of `.continuerc.json` will overwrite that property from `config.json`.

Example

```json
{
  "tabAutocompleteOptions": {
    "disable": true
  },
  "mergeBehavior": "overwrite"
}
```
