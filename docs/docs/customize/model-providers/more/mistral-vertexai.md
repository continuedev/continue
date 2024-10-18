---
title: Mistral Vertex AI
slug: ../mistral-vertexai
---

:::info

You need to enable the [Vertex AI API](https://console.cloud.google.com/marketplace/product/google/aiplatform.googleapis.com) and set up the [Google Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc).

:::

## Chat model

We recommend configuring **Mistral Large** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Mistral Large (Vertex AI)",
      "provider": "mistral-vertexai",
      "model": "mistral-large",
      "projectId": "[PROJECT_ID]",
      "region": "us-central1"
    }
  ]
}
```

## Autocomplete model

We recommend configuring **Codestral** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Codestral (Vertex AI)",
    "provider": "mistral-vertexai",
    "model": "codestral",
    "projectId": "[PROJECT_ID]",
    "region": "us-central1"
  }
}
```

## Embeddings model

Mistral Vertex AI currently does not offer any embeddings models.

[Click here](../../model-types/embeddings.md) to see a list of embeddings model providers.

## Reranking model

Mistral Vertex AI currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
