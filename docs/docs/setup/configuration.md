---
title: Configuration
description: Configure your LLM and model provider
keywords: [configure, llm, provider]
---

# Configuration

Want a quick and easy setup for Continue? We've got you covered with some sample `config.json` files for different scenarios. Just copy and paste them into your `config.json` by clicking the gear icon at the bottom right of the Continue sidebar.

## Quick Setup Options

You can use Continue in different ways. Here are some quick setups for common uses:

- [Free Trial](#free-trial) - Try Continue without any additional setup.
- [Best Overall Experience](#best-overall-experience) - Utilize the hand picked models for the best experience.
- [Local and Offline](#local-and-offline-configuration) - Use local models for offline use with better privacy.

### Free Trial

The `free-trial` lets new users try out Continue with GPT-4o, Llama3, Claude 3.5, and other models using a ContinueDev proxy server that securely makes API calls to these services.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "GPT-4o (trial)",
      "provider": "free-trial",
      "model": "gpt-4o"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Codestral (trial)",
    "provider": "free-trial",
    "model": "AUTODETECT"
  },
  "embeddingsProvider": {
    "provider": "free-trial"
  },
  "reranker": {
    "name": "free-trial"
  }
}
```

### Best Overall Experience

This setup uses Claude 3.5 Sonnet for chatting, Codestral for autocomplete, and Voyage AI for embeddings and reranking.

**What You Need:**

1. Get an Anthropic API key from [Anthropic Console](https://console.anthropic.com/account/keys)
2. Get a Codestral API key from [Mistral AI's La Plateforme](https://console.mistral.ai/codestral)
3. Get an Voyage AI API key from [Voyage AI Dashboard](https://dash.voyageai.com/)
4. Replace `[CODESTRAL_API_KEY]`, `[ANTHROPIC_API_KEY]`, and `[VOYAGE_API_KEY]` with the keys you got from the above links.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "[ANTHROPIC_API_KEY]"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "[CODESTRAL_API_KEY]"
  },
  "embeddingsProvider": {
    "provider": "voyage",
    "model": "voyage-code-2",
    "apiBase": "https://api.voyageai.com/v1/",
    "apiKey": "[VOYAGE_AI_API_KEY]"
  },
  "reranker": {
    "name": "voyage",
    "params": {
      "apiKey": "[VOYAGE_AI_API_KEY]"
    }
  }
}
```

### Local and Offline Configuration

This configuration leverages Ollama for all functionalities - chat, autocomplete, and embeddings - ensuring that no code is transmitted outside your machine, allowing Continue to be run even on an air-gapped computer.

**What You Need:**

1. Download Ollama from [Ollama's Official Site](https://ollama.ai)
2. Pull the required models:
   - For chat: `ollama pull llama3:8b`
   - For autocomplete: `ollama pull starcoder2:3b`
   - For embeddings: `ollama pull nomic-embed-text`

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "AUTODETECT"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Starcoder 2 3b",
    "provider": "ollama",
    "model": "starcoder2:3b"
  },
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text"
  }
}
```

If you require a fully air-gapped setup, you may also want to:

1. For VS Code, manually download the latest .vsix file from the [Open VSX Registry](https://open-vsx.org/extension/Continue/continue) rather than the VS Code Marketplace and [install it to VS Code](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix). For JetBrains, manually download the .zip file from the [JetBrains Plugin Repository](https://plugins.jetbrains.com/plugin/22707-continue) and [install it to your IDE](https://www.jetbrains.com/help/idea/managing-plugins.html#install_plugin_from_disk).
2. Open `~/.continue/config.json` and set `"allowAnonymousTelemetry": false`. This will stop Continue from attempting requests to PostHog for [anonymous telemetry](../telemetry.md).

## Setting up chat models

In `config.json`, you'll find the `models` property, a list of the models that you have saved to use with Continue:

```json
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
]
```

Just by specifying the `model` and `provider` properties, we will automatically detect prompt templates and other important information, but if you're looking to do something beyond this basic setup, we'll explain a few other options below.

## Self-hosting an open-source model

For many cases, either Continue will have a built-in provider or the API you use will be OpenAI-compatible, in which case you can use the "openai" provider and change the "baseUrl" to point to the server.

However, if neither of these are the case, you will need to wire up a new LLM object. Learn how to do this [here](#defining-a-custom-llm-provider).

## Authentication

Basic authentication can be done with any provider using the `apiKey` field:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "apiKey": "xxx"
    }
  ]
}
```

This translates to the header `"Authorization": "Bearer xxx"`.

If you need to send custom headers for authentication, you may use the `requestOptions.headers` property like in this example with Ollama:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "requestOptions": {
        "headers": {
          "X-Auth-Token": "xxx"
        }
      }
    }
  ]
}
```

Similarly if your model requires a Certificate for authentication, you may use the `requestOptions.clientCertificate` property like in the example below:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "requestOptions": {
        "clientCertificate": {
          "cert": "C:\tempollama.pem",
          "key": "C:\tempollama.key",
          "passphrase": "c0nt!nu3"
        }
      }
    }
  ]
}
```

## Context Length

Continue by default knows the context length for common models. For example, it will automatically assume 200k tokens for Claude 3. For Ollama, the context length is determined automatically by asking Ollama. If neither of these are sufficient, you can manually specify the context length by using hte `"contextLength"` property in your model in config.json.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "My Custom Model",
      "provider": "openai",
      "model": "my-model",
      "contextLength": 8192,
      "apiBase": "http://localhost:8000/v1"
    }
  ]
}
```

## Customizing the Chat Template

Most open-source models expect a specific chat format, for example llama2 and codellama expect the input to look like `"[INST] How do I write bubble sort in Rust? [/INST]"`. Continue will automatically attempt to detect the correct prompt format based on the `model`value that you provide, but if you are receiving nonsense responses, you can use the `template` property to explicitly set the format that you expect. The options are: `["llama2", "alpaca", "zephyr", "phind", "anthropic", "chatml", "openchat", "neural-chat", "none"]`.

If you want to create an entirely new chat template, this can be done in [config.ts](../customization/code-config.md) by defining a function and adding it to the `templateMessages` property of your `LLM`. Here is an example of `templateMessages` for the Alpaca/Vicuna format:

```typescript
function templateAlpacaMessages(msgs: ChatMessage[]): string {
  let prompt = "";

  if (msgs[0].role === "system") {
    prompt += `${msgs[0].content}\n`;
    msgs.pop(0);
  }

  prompt += "### Instruction:\n";
  for (let msg of msgs) {
    prompt += `${msg.content}\n`;
  }

  prompt += "### Response:\n";

  return prompt;
}
```

It can then be used like this:

```typescript title="~/.continue/config.ts"
function modifyConfig(config: Config): Config {
  const model = config.models.find(
    (model) => model.title === "My Alpaca Model",
  );
  if (model) {
    model.templateMessages = templateAlpacaMessages;
  }
  return config;
}
```

This exact function and a few other default implementations are available in [`continuedev.libs.llm.prompts.chat`](https://github.com/continuedev/continue/blob/main/server/continuedev/libs/llm/prompts/chat.py).

## Customizing the /edit Prompt

You also have access to customize the prompt used in the '/edit' slash command. We already have a well-engineered prompt for GPT-4 and sensible defaults for less powerful open-source models, but you might wish to play with the prompt and try to find a more reliable alternative if you are for example getting English as well as code in your output.

To customize the prompt, use the `promptTemplates` property of any model, which is a dictionary, and set the "edit" key to a template string with Mustache syntax. The 'filePrefix', 'fileSuffix', 'codeToEdit', 'language', 'contextItems', and 'userInput' variables are available in the template. Here is an example of how it can be set in `config.ts`:

```typescript title="~/.continue/config.ts"
const codellamaEditPrompt = `\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`
[INST] You are an expert programmer and personal assistant. Your task is to rewrite the above code with these instructions: "{{{userInput}}}"

Your answer should be given inside of a code block. It should use the same kind of indentation as above.
[/INST] Sure! Here's the rewritten code you requested:
\`\`\`{{{language}}}`;

function modifyConfig(config: Config): Config {
  config.models[0].promptTemplates["edit"] = codellamaEditPrompt;
  return config;
}
```

You can find all existing templates for /edit in [`core/llm/templates/edit.ts`](https://github.com/continuedev/continue/blob/main/core/llm/templates/edit.ts).

## Defining a Custom LLM Provider

If you are using an LLM API that isn't already [supported by Continue](./select-provider.md), and is not an OpenAI-compatible API, you'll need to define a `CustomLLM` object in `config.ts`. This object only requires one of (or both of) a `streamComplete` or `streamChat` function. Here is an example:

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.models.push({
    options: {
      title: "My Custom LLM",
      model: "mistral-7b",
    },
    streamCompletion: async function* (
      prompt: string,
      options: CompletionOptions,
      fetch,
    ) {
      // Make the API call here

      // Then yield each part of the completion as it is streamed
      // This is a toy example that will count to 10
      for (let i = 0; i < 10; i++) {
        yield `- ${i}\n`;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
  });
  return config;
}
```
