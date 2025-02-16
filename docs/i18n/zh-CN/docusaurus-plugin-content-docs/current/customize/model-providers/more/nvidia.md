---
title: NVIDIA
---

:::info

[查看文档](https://docs.nvidia.com/nim/large-language-models/latest/getting-started.html#option-1-from-api-catalog) 了解如何获取一个 API key 。

:::

## 聊天模型

我们推荐配置 **Nemotron-4-340B-Instruct** 作为你的聊天模型。

```json title="config.json"
{
  "models": [
    {
      "title": "Nemotron-4-340B-Instruct",
      "provider": "nvidia",
      "model": "nvidia-nemotron-4-340b-instruct",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## 自动补全模型

NVIDIA 当前不提供任何自动补全模型。

[点击这里](../../model-types/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

我们推荐配置 **NVIDIA Retrieval QA Mistral 7B** 作为你的嵌入模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "nvidia",
    "model": "nvidia/nv-embedqa-mistral-7b-v2",
    "apiKey": "[API_KEY]"
  }
}
```

## 重排序模型

NVIDIA 当前不提供任何重排序模型。

[点击这里](../../model-types/reranking.md) 查看重排序模型提供者列表。
