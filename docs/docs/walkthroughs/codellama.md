---
title: Using Code Llama with Continue
description: How to use Code Llama with Continue
keywords: [code llama, meta, togetherai, ollama, replciate, fastchat]
---

# Using Code Llama with Continue

With Continue, you can use Code Llama as a drop-in replacement for GPT-4, either by running locally with Ollama or GGML or through Replicate.

If you haven't already installed Continue, you can do that [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue). For more general information on customizing Continue, read [our customization docs](../customization/overview.md).

## TogetherAI

1. Create an account [here](https://api.together.xyz/signup)
2. Copy your API key that appears on the welcome screen
3. Update your Continue config file like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Code Llama",
      "provider": "together",
      "model": "togethercomputer/CodeLlama-13b-Instruct",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

## Ollama

1. Download Ollama [here](https://ollama.ai/) (it should walk you through the rest of these steps)
2. Open a terminal and run `ollama run codellama`
3. Change your Continue config file like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Code Llama",
      "provider": "ollama",
      "model": "codellama-7b"
    }
  ]
}
```

## Replicate

1. Get your Replicate API key [here](https://replicate.ai/)
2. Change your Continue config file like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Code Llama",
      "provider": "replicate",
      "model": "codellama-7b",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

## FastChat API

1. Setup the FastChat API (https://github.com/lm-sys/FastChat) to use one of the Codellama models on Hugging Face (e.g: codellama/CodeLlama-7b-Instruct-hf).
2. Start the OpenAI compatible API (ref: https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md).
3. Change your Continue config file like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Code Llama",
      "provider": "openai",
      "model": "codellama-7b",
      "apiBase": "http://localhost:8000/v1/"
    }
  ]
}
```
