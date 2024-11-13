---
title: Anthropic
slug: ../anthropic
---

:::info
你可以从 [Anthropic 控制台](https://console.anthropic.com/account/keys) 获取 API key 。
:::

## 聊天模型

我们推荐配置 **Claude 3.5 Sonnet** 作为你的聊天模型。

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## 自动补全模型

Anthropic 当前没有提供任何自动补全模型。

[点击这里](../../model-types/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

Anthropic 当前没有提供任何嵌入模型。

[点击这里](../../model-types/embeddings.md) 查看嵌入模型提供者列表。

## 重排序模型

Anthropic 当前没有提供任何重排序模型。

[点击这里](../../model-types/reranking.md) 查看重排序模型提供者列表。

## 提示词缓存

Anthropic 提供 [Claude 的提示词缓存](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) 。

为了打开系统消息和逐轮交谈的缓存，像下面这样更新你的模型配置：

```json
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
