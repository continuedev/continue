---
title: Gemini
slug: ../gemini
---

:::info
你可以从 [Google AI Studio](https://aistudio.google.com/) 获取 API key 。
:::

## 聊天模型

我们推荐配置 **Gemini 1.5 Pro** 作为你的聊天模型。

```json title="config.json"
{
  "models": [
    {
      "title": "Gemini 1.5 Pro",
      "provider": "gemini",
      "model": "gemini-1.5-pro-latest",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## 自动补全模型

Gemini 当前没有提供任何自动补全模型。

[点击这里](../../model-roles/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

我们推荐配置 **text-embedding-004** 作为你的嵌入模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "gemini",
    "model": "models/text-embedding-004",
    "apiKey": "[API_KEY]"
  }
}
```

## 重排序模型

Gemini 当前没有提供任何重排序模型。

[点击这里](../../model-roles/reranking.md) 查看重排序模型提供者列表。
