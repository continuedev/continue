---
title: Gemini Vertex AI
slug: ../gemini-vertexai
---

:::info

You need to enable the [Vertex AI API](https://console.cloud.google.com/marketplace/product/google/aiplatform.googleapis.com) and set up the [Google Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc).

:::

## Chat model

We recommend configuring **Gemini 1.5 Pro** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Gemini 1.5 Pro (Vertex AI)",
      "provider": "gemini-vertexai",
      "model": "gemini-1.5-pro",
      "projectId": "[PROJECT_ID]",
      "region": "us-central1"
    }
  ]
}
```

## Autocomplete model

Gemini Vertex AI currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

We recommend configuring **text-embedding-004** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "vertex",
    "model": "text-embedding-004",
    "projectId": "[PROJECT_ID]",
    "region": "us-central1"
  }
}
```


## Reranking model

Gemini Vertex AI currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
