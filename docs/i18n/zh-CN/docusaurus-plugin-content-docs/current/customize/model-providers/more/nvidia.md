---
title: NVIDIA
---

:::info

[View the docs](https://docs.nvidia.com/nim/large-language-models/latest/getting-started.html#option-1-from-api-catalog) to learn how to get an API key.

:::

## Chat model

We recommend configuring **Nemotron-4-340B-Instruct** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Nemotron-4-340B-Instruct",
      "provider": "nvidia",
      "model": "nvidia-nemotron-4-340b-instruct",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

NVIDIA currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

We recommend configuring **NVIDIA Retrieval QA Mistral 7B** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "nvidia",
    "model": "nvidia/nv-embedqa-mistral-7b-v2",
    "apiKey": "[API_KEY]"
  }
}
```

## Reranking model

NVIDIA currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
