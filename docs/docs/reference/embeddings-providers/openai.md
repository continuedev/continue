---
title: Open AI
---

[OpenAI's embeddings](https://platform.openai.com/docs/guides/embeddings) are high dimensional embeddings that give great performance on both text and code.

## Configuration for the `text-embedding-3-small` model

This is default. The `text-embedding-3-small` model offers an outstanding balance between performance and efficiency, suitable for a versatile range of applications.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

## Configuration for the `text-embedding-3-large` model

For those requiring the highest level of embedding detail and precision, the `text-embedding-3-large` model is the better choice.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

## Legacy Model Configuration

For certain scenarios, you may still find the `text-embedding-ada-002` model relevant. Below is the configuration example:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```
