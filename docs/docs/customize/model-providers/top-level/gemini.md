---
title: Gemini
slug: ../gemini
---

:::info

You can get an API key from the [Google AI Studio](https://aistudio.google.com/).

:::

## Chat model

We recommend configuring **Gemini 1.5 Pro** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Gemini 1.5 Pro",
      "provider": "gemini",
      "model": "gemini-1.5-pro-latest",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

### Other Available Models

- **Gemini 1.5 Flash** - Fast and versatile multimodal model with 1M token context length
```json title="config.json"
{
  "title": "Gemini 1.5 Flash",
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "apiKey": "[API_KEY]"
}
```

### Experimental Models

The following experimental models are also available:

- **Gemini 2.0 Flash Experimental** - Experimental version with 1M token context length
```json title="config.json"
{
  "title": "Gemini 2.0 Flash Experimental",
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp",
  "apiKey": "[API_KEY]"
}
```

- **Gemini 2.0 Flash Thinking Experimental** - Optimized for reasoning tasks with 32K context
```json title="config.json"
{
  "title": "Gemini 2.0 Flash Thinking Experimental",
  "provider": "gemini",
  "model": "gemini-2.0-flash-thinking-exp",
  "apiKey": "[API_KEY]"
}
```

- **Gemini Experimental 1206** - Experimental release with 2M token context length
```json title="config.json"
{
  "title": "Gemini Experimental 1206",
  "provider": "gemini",
  "model": "gemini-exp-1206",
  "apiKey": "[API_KEY]"
}
```

## Autocomplete model

Gemini currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

We recommend configuring **text-embedding-004** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "gemini",
    "model": "models/text-embedding-004",
    "apiKey": "[API_KEY]"
  }
}
```

## Reranking model

Gemini currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
