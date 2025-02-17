---
title: Scaleway
---

:::info

Scaleway Generative APIs 给你立即访问到托管在欧洲数据中心的领先的 AI 模型，特别适合需要低延迟，完整数据隐私，适配 EU AI Act 的开发者。
你可以在 [Scaleway's console](https://console.scaleway.com/generative-api/models) 生成你的 API key 。
查看 [快速入门文档在这里](https://www.scaleway.com/en/docs/ai-data/generative-apis/quickstart/) 。

:::

## 聊天模型

我们推荐配置 **Qwen2.5-Coder-32B-Instruct** 作为你的聊天模型。

[点击这里](https://www.scaleway.com/en/docs/ai-data/generative-apis/reference-content/supported-models/) 查看可用的聊天模型列表。

```json title="config.json"
{
  "models": [
    {
      "title": "Qwen2.5-Coder-32B-Instruct",
      "provider": "scaleway",
      "model": "qwen2.5-coder-32b-instruct",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## 自动补全模型

Scaleway 当前没有提供任何自动补全模型。

[点击这里](../../model-types/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

我们推荐配置 **BGE-Multilingual-Gemma2** 作为你的嵌入模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "scaleway",
    "model": "bge-multilingual-gemma2",
    "apiKey": "[API_KEY]"
  }
}
```
