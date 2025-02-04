---
title: xAI
slug: ../xai
---

:::info

You can get an API key from the [xAI console](https://console.x.ai/)

:::

## Chat model

We recommend configuring **grok-2-latest** as your chat model. For information on other available models, visit [xAI Documentation](https://docs.x.ai/docs/models).

```json title="config.json"
{
  "models": [
    {
      "title": "Grok 2",
      "provider": "xAI",
      "model": "grok-2-latest",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

xAI currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

xAI currently does not offer any embeddings models.

[Click here](../../model-types/embeddings.md) to see a list of embeddings model providers.

## Reranking model

xAI currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.

## Legacy Completions

To force usage of `chat/completions` instead of `completions` endpoint you can set

```json
"useLegacyCompletionsEndpoint": false
```
