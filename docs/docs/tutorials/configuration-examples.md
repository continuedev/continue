---
title: Configuration Examples
description: Configure your LLM and model provider
keywords: [configure, llm, provider]
---

Want a quick and easy setup for Continue? We've got you covered with some sample `config.json` files for different scenarios. Just copy and paste them into your `config.json` by clicking the gear icon at the bottom right of the Continue sidebar.

You can use Continue in different ways. Here are some quick setups for common uses:

- [Free Trial](#free-trial) - Try Continue without any additional setup.
- [Best Overall Experience](#best-overall-experience) - Utilize the hand picked models for the best experience.
- [Local and Offline](#local-and-offline-configuration) - Use local models for offline use with better privacy.

## Free Trial

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

## Best Overall Experience

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
    "provider": "openai",
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

## Local and Offline Configuration

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
2. Open `~/.continue/config.json` and set `"allowAnonymousTelemetry": false`. This will stop Continue from attempting requests to PostHog for [anonymous telemetry](../privacy/telemetry.md).
