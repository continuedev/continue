---
title: Mistral
slug: ../mistral
---

:::info
你可以从 [Mistral Dashboard](https://console.mistral.ai) 获取 API key 。注意 Codestral (codestral.mistral.ai) 的 API key 是与所有其他模型 (api.mistral.ai) 不同的。
:::

## 聊天模型

我们推荐配置 **Mistral Large** 作为你的聊天模型。

```json title="config.json"
{
  "models": [
    {
      "title": "Mistral Large",
      "provider": "mistral",
      "model": "mistral-large-latest",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## 自动补全模型

我们推荐配置 **Codestral** 作为你的自动补全模型。

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest"
  }
}
```

## 嵌入模型

我们推荐配置 **Mistral Embed** 作为你的嵌入模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "mistral",
    "model": "mistral-embed",
    "apiKey": "[API_KEY]",
    "apiBase": "https://api.mistral.ai/v1"
  }
}
```

## 重排序模型

Mistral 当前没有提供任何重排序模型。

[点击这里](../../model-roles/reranking.md) 查看重排序模型提供者列表。
