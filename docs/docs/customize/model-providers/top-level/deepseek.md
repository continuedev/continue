---
title: DeepSeek
slug: ../deepseek
---

:::info

You can get an API key from the [DeepSeek console](https://www.deepseek.com/).

:::

## Chat model

We recommend configuring **DeepSeek Chat** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "DeepSeek Chat",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

We recommend configuring **DeepSeek Coder** as your autocomplete model.

```json title="config.json"
{
  "completionOptions": {
    "BaseCompletionOptions": {
        "temperature": 0.0,
        "maxTokens": 256
    }
  },
  "tabAutocompleteModel": {
    "title": "DeepSeek",
    "model": "deepseek-chat",
    "apiKey": "REDACTED",
    "provider": "deepseek",
    "apiBase": "https://api.deepseek.com/beta"
  },
...
```
DeepSeek AutoComplete model config setting,refer [DeepSeek AutoComplete](https://github.com/deepseek-ai/awesome-deepseek-integration/blob/main/docs/continue/README.md)
## Embeddings model

DeepSeek currently does not offer any embeddings models.

[Click here](../../model-types/embeddings.md) to see a list of embeddings model providers.

## Reranking model

DeepSeek currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
