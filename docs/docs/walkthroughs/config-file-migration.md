---
title: Config File Migration
description: Migrating from config.py to config.json
keywords: [json, config, configuration, migration]
---

# Migration to `config.json`

On November 20, 2023, we migrated to using JSON as the primary config file format. If you previously used Continue, we will have attempted to automatically translate your existing config.py into a config.json file. If this fails, we will fallback to a default config.json. Your previous config.py will still be kept, but moved to config.py.old for reference. Below you can find a list of changes that were made in case you need to manually migrate your config, as well as examples of proper config.json files.

The JSON format provides stronger guiderails, making it easier to write a valid config, while still allowing Intellisense in VS Code.

If you need any help migrating, please reach out to us on Discord.

## Configuration as Code

> Continue has moved to using Typescript configuration. To learn about this, please see [Configuration as Code](../customization/code-config.md).

For configuration that requires code, we now provide a simpler interface that works alongside config.json. In the same folder, `~/.continue`, create a file named `config.ts` and add a function called `modifyConfig`. This function should take a `Config` object as its only argument, and return a `Config` object. This object is essentially the same as the one that was previously defined in `config.py`. This allows you to modify the initial configuration object defined in your `config.json`. Here's an example that cuts the temperature in half:

```typescript
function modifyConfig(config: Config): Config {
  config.completionOptions.temperature /= 2;
  return config;
}
```

To summarize, these are the steps taken to load your configuration:

1. Load `~/.continue/config.json`
2. Convert this into a `Config` object
3. If `~/.continue/config.ts` exists and has defined `modifyConfig` correctly, call `modifyConfig` with the `Config` object to generate the final configuration

## List of Changes

### `completionOptions`

The properties `topP`, `topK`, `temperature`, `presencePenalty`, and `frequencyPenalty` have been moved into a single object called `completionOptions`. It can be specified at the top level of the config or within a `models` object.

### `requestOptions`

The properties `timeout`, `verify_ssl`, `ca_bundle_path`, `proxy`, and `headers` have been moved into a single object called `request_options`, which can be specified for each `models` object.

### The `model` property

Instead of writing something like `Ollama(model="phind-codellama:34b", ...)`, where the `model` property was different depending on the provider and had to be exactly correct, we now offer a default set of models, including the following:

```python
    # OpenAI
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "gpt-4",
    "gpt-3.5-turbo-0613",
    "gpt-4-32k",
    "gpt-4-turbo-preview",
    # Open-Source
    "mistral-7b",
    "llama2-7b",
    "llama2-13b",
    "codellama-7b",
    "codellama-13b",
    "codellama-34b",
    "phind-codellama-34b",
    "wizardcoder-7b",
    "wizardcoder-13b",
    "wizardcoder-34b",
    "zephyr-7b",
    "codeup-13b",
    "deepseek-1b",
    "deepseek-7b",
    "deepseek-33b",
    "neural-chat-7b",
    # Anthropic
    "claude-2",
    # Google PaLM
    "chat-bison-001",
```

If you want to use a model not listed here, you can still do that by specifying whichever value of `model` you need. But if there's something you think we should add as a default, let us know!

### Prompt template auto-detection

Based on the `model` property, we now attempt to [autodetect](https://github.com/continuedev/continue/blob/108e00c7db9cad110c5df53bdd0436b286b92466/server/continuedev/core/config_utils/shared.py#L38) the prompt template. If you want to be explicit, you can select one of our prompt template types (`"llama2", "alpaca", "zephyr", "phind", "anthropic", "chatml", "deepseek", "neural-chat"`) or write a custom prompt template in `config.py`.

### `PromptTemplate`

If you were previously using the `PromptTemplate` class in your `config.py` to write a custom template, we have moved it from `continuedev.libs.llm.base` to `continuedev.models.llm`.

## Examples of `config.json`

After the "Full example" these examples will only show the relevant portion of the config file.

### Full example, with Free Trial Models

```json
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "free-trial",
      "model": "gpt-4"
    },
    {
      "title": "GPT-3.5-Turbo",
      "provider": "free-trial",
      "model": "gpt-3.5-turbo"
    }
  ],
  "system_message": "Always be kind",
  "completion_options": {
    "temperature": 0.5
  },
  "model_roles": {
    "default": "GPT-4",
    "summarize": "GPT-3.5-Turbo"
  },
  "slash_commands": [
    {
      "name": "edit",
      "description": "Edit highlighted code",
      "step": "EditHighlightedCodeStep"
    },
    {
      "name": "config",
      "description": "Customize Continue",
      "step": "OpenConfigStep"
    },
    {
      "name": "comment",
      "description": "Write comments for the highlighted code",
      "step": "CommentCodeStep"
    },
    {
      "name": "share",
      "description": "Download and share this session",
      "step": "ShareSessionStep"
    },
    {
      "name": "cmd",
      "description": "Generate a shell command",
      "step": "GenerateShellCommandStep"
    }
  ],
  "custom_commands": [
    {
      "name": "test",
      "prompt": "Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ],
  "context_providers": [{ "name": "terminal" }, { "name": "diff" }]
}
```

### Ollama with CodeLlama 13B

```json
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "codellama-13b"
    }
  ]
}
```

### Claude 2

```json
{
  "models": [
    {
      "title": "Claude-2",
      "provider": "anthropic",
      "model": "claude-2",
      "api_key": "sk-ant-api03-REST_OF_API_KEY",
      "context_length": 100000
    }
  ]
}
```

### LM Studio with Phind Codellama 34B

```json
{
  "models": [
    {
      "title": "LM Studio",
      "provider": "lmstudio",
      "model": "phind-codellama-34b"
    }
  ]
}
```

### OpenAI-compatible API

This is an example of serving a model using an OpenAI-compatible API on http://localhost:8000.

```json
{
  "models": [
    {
      "title": "OpenAI-compatible API",
      "provider": "openai",
      "model": "codellama-13b",
      "api_base": "http://localhost:8000"
    }
  ]
}
```

### Azure OpenAI

```json
{
  "models": [
    {
      "title": "Azure OpenAI",
      "provider": "openai",
      "model": "gpt-3.5-turbo",
      "api_key": "my-api-key",
      "api_base": "https://my-azure-openai-instance.openai.azure.com/",
      "engine": "my-azure-openai-deployment",
      "api_version": "2023-07-01-preview",
      "api_type": "azure"
    }
  ]
}
```

### TogetherAI

```json
{
  "models": [
    {
      "title": "Phind CodeLlama",
      "provider": "together",
      "model": "phind-codellama-34b",
      "api_key": "<your-api-key>"
    }
  ]
}
```

### Temperature, top_p, etc...

The `completions_options` for each model will override the top-level `completion_options`. For example, the "GPT-4" model here will have a temperature of 0.8, while the "GPT-3.5-Turbo" model will have a temperature of 0.5.

```json
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "free-trial",
      "model": "gpt-4",
      "completion_options": {
        "top_p": 0.9,
        "top_k": 40,
        "temperature": 0.8
      }
    },
    {
      "title": "GPT-3.5-Turbo",
      "provider": "free-trial",
      "model": "gpt-3.5-turbo"
    }
  ],
  "completion_options": {
    "temperature": 0.5,
    "presence_penalty": 0.5,
    "frequency_penalty": 0.5
  }
}
```
