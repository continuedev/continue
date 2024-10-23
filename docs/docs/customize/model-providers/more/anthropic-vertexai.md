---
title: Anthropic Vertex AI
slug: ../anthropic-vertexai
---

:::info

You need to enable the [Vertex AI API](https://console.cloud.google.com/marketplace/product/google/aiplatform.googleapis.com) and set up the [Google Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc).

:::

## Chat model

We recommend configuring **Claude 3.5 Sonnet** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "anthropic-vertexai",
      "model": "claude-3-5-sonnet-20240620",
      "projectId": "[PROJECT_ID]",
      "region": "us-east5"
    }
  ]
}
```

## Autocomplete model

Anthropic Vertex AI currently does not offer any autocomplete models.

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

Anthropic Vertex AI currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.

## Prompt caching

Anthropic Vertex AI supports [prompt caching with Claude](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching).

To enable caching of the system message and the turn-by-turn conversation, update your your model configuration as following:

```jsonc
{
  "models": [
    {
      // Enable prompt caching
      "cacheBehavior": {
        "cacheSystemMessage": true,
        "cacheConversation": true
      },
      "title": "Anthropic",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "[API_KEY]"
    }
  ]
}
```
