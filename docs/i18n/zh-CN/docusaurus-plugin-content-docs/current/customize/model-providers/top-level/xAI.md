---
title: xAI
slug: ../xai
---

:::info

你可以从 [xAI console](https://console.x.ai/) 获取一个 API key

:::

## 聊天模型

我们推荐配置 **grok-beta** 作为你的聊天模型。

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

## 自动补全模型

xAI 当前没有提供任何自动补全模型。

[点击这里](../../model-types/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

xAI 当前没有提供任何嵌入模型。

[点击这里](../../model-types/embeddings.md) 查看嵌入模型提供者列表。

## 重排序模型

xAI 当前没有提供任何重排序模型。

[点击这里](../../model-types/reranking.md) 查看重排序模型提供者列表。

## Legacy Completions

为了强制使用 `chat/completions` 替代 `completions` 端点，你可以设置

```json
"useLegacyCompletionsEndpoint": false
```
