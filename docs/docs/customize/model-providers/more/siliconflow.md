---
title: SiliconFlow
---

:::info

You can get an API key from the [Silicon Cloud](https://cloud.siliconflow.cn/account/ak).

:::

## Chat model

We recommend configuring **Qwen/Qwen2.5-Coder-32B-Instruct** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Qwen",
      "provider": "siliconflow",
      "model": "Qwen/Qwen2.5-Coder-32B-Instruct",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

We recommend configuring **Qwen/Qwen2.5-Coder-7B-Instruct** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Qwen",
    "provider": "siliconflow",
    "model": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "apiKey": "[API_KEY]"
  }
}
```

## Embeddings model

SiliconFlow provide some embeddings models, [Click here](https://siliconflow.cn/models) to see a list of embeddings models.

## Reranking model

SiliconFlow provide some reranking models, [Click here](https://siliconflow.cn/models) to see a list of reranking models.
