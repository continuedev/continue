---
title: GitHub Copilot
slug: ../github-copilot
---

:::info

You can get an API key from the [GitHub Copilot settings](https://github.com/settings/copilot).

:::

## Chat model

We recommend configuring **GitHub Copilot** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "GitHub Copilot",
      "provider": "github-copilot",
      "model": "github-copilot",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

We recommend configuring **GitHub Copilot** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "GitHub Copilot",
    "provider": "github-copilot",
    "model": "github-copilot",
    "apiKey": "[API_KEY]"
  }
}
```

## Embeddings model

GitHub Copilot currently does not offer any embeddings models.

[Click here](../../model-types/embeddings.md) to see a list of embeddings model providers.

## Reranking model

GitHub Copilot currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
