---
title: Mistral
slug: ../mistral
---

:::info

You can get an API key from the [Mistral Dashboard](https://console.mistral.ai). Note that the API key for Codestral (codestral.mistral.ai) is different from for all other models (api.mistral.ai).

:::

## Chat model

We recommend configuring **Mistral Large** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Mistral Large",
      "provider": "mistral",
      "model": "mistral-large-latest",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

We recommend configuring **Codestral** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest"
  }
}
```

## Embeddings model

We recommend configuring **Mistral Embed** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "mistral",
    "model": "mistral-embed",
    "apiKey": "[API_KEY]",
    "apiBase": "https://api.mistral.ai/v1"
  }
}
```

## Reranking model

Mistral currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
