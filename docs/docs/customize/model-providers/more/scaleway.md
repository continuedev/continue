---
title: Scaleway
---

:::info

Scaleway Generative APIs give you instant access to leading AI models hosted in European data centers, ideal for developers requiring low latency, full data privacy, and compliance with EU AI Act.
You can generate your API key in [Scaleway's console](https://console.scaleway.com/generative-api/models).
Read the [quickstart documentation here](https://www.scaleway.com/en/docs/ai-data/generative-apis/quickstart/).

:::

## Chat model

We recommend configuring **Qwen2.5-Coder-32B-Instruct** as your chat model.
[Click here](https://www.scaleway.com/en/docs/ai-data/generative-apis/reference-content/supported-models/) to see the list of available chat models.

```json title="config.json"
{
  "models": [
    {
      "title": "Qwen2.5-Coder-32B-Instruct",
      "provider": "scaleway",
      "model": "qwen2.5-coder-32b-instruct",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

Scaleway currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

We recommend configuring **BGE-Multilingual-Gemma2** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "scaleway",
    "model": "bge-multilingual-gemma2",
    "apiKey": "[API_KEY]"
  }
}
```