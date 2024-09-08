---
title: Mistral
---

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
  "embeddingsProvider": [
    {
      "provider": "mistral",
      "model": "mistral-embed",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Reranking model

Mistral currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see our full list of reranking model providers.
