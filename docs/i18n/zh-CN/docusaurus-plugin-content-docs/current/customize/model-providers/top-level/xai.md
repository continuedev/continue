---
title: xAI
slug: ../xai
---

:::info

You can get an API key from the [xAI console](https://console.x.ai/)

:::

## Chat model

We recommend configuring **grok-beta** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Grok Beta",
      "provider": "xAI",
      "model": "grok-beta",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

xAI currently does not offer any autocomplete models.

[Click here](../../model-roles/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

xAI currently does not offer any embeddings models.

[Click here](../../model-roles/embeddings.md) to see a list of embeddings model providers.

## Reranking model

xAI currently does not offer any reranking models.

[Click here](../../model-roles/reranking.md) to see a list of reranking model providers.

## Legacy Completions

To force usage of `chat/completions` instead of `completions` endpoint you can set `useLegacyCompletionsEndpoint` to `true`:

```json title="config.json"
  "models": [
    {
      "title": "Grok Beta",
      "provider": "xAI",
      "model": "grok-beta",
      "apiKey": "[API_KEY]",
      "useLegacyCompletionsEndpoint": false
    }
  ]
```
