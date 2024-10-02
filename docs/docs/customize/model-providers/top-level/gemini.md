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
