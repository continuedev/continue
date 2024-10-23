---
title: Vertex AI
slug: ../vertexai
---

:::info

You need to enable the [Vertex AI API](https://console.cloud.google.com/marketplace/product/google/aiplatform.googleapis.com) and set up the [Google Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc).

:::

## Chat model

We recommend configuring **Mistral Large**, **Gemini 1.5 Pro**, or **Claude 3.5 Sonnet** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Mistral Large (Vertex AI)",
      "provider": "vertexai",
      "model": "mistral-large",
      "projectId": "[PROJECT_ID]",
      "region": "us-central1"
    }
  ]
}
```

```json title="config.json"
{
  "models": [
    {
      "title": "Gemini 1.5 Pro (Vertex AI)",
      "provider": "vertexai",
      "model": "gemini-1.5-pro",
      "projectId": "[PROJECT_ID]",
      "region": "us-central1"
    }
  ]
}
```

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "vertexai",
      "model": "claude-3-5-sonnet-20240620",
      "projectId": "[PROJECT_ID]",
      "region": "us-east5"
    }
  ]
}
```


## Autocomplete model

We recommend configuring **Codestral** or **code-gecko** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Codestral (Vertex AI)",
    "provider": "vertexai",
    "model": "codestral",
    "projectId": "[PROJECT_ID]",
    "region": "us-central1"
  }
}
```

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Code Gecko (Vertex AI)",
    "provider": "vertexai",
    "model": "codestral",
    "projectId": "[PROJECT_ID]",
    "region": "us-central1"
  }
}
```

## Embeddings model

We recommend configuring **text-embedding-004** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "vertexai",
    "model": "text-embedding-004",
    "projectId": "[PROJECT_ID]",
    "region": "us-central1"
  }
}
```

## Reranking model

Vertex AI currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
