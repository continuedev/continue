---
title: Azure OpenAI
slug: ../azure
---

## 聊天模型

我们推荐配置 **GPT-4o** 作为你的聊天模型。

```json title="config.json"
"models": [{
    "title": "GPT-4o",
    "provider": "azure",
    "model": "gpt-4o",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "engine": "<YOUR_ENGINE>",
    "apiVersion": "<YOUR_API_VERSION>",
    "apiType": "azure",
    "apiKey": "<MY_API_KEY>"
}]
```

## 自动补全模型

我们推荐配置 **Codestral** 作为你的自动补全模型。

```json title="config.json"
"tabAutocompleteModel": [{
    "title": "Codestral",
    "provider": "azure",
    "model": "codestral-latest",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "engine": "<YOUR_ENGINE>",
    "apiVersion": "<YOUR_API_VERSION>",
    "apiType": "azure",
    "apiKey": "<MY_API_KEY>"
}]
```

## 嵌入模型

我们推荐配置 **text-embedding-3-large** 作为你的嵌入模型。

```json title="config.json"
"embeddingsProvider": {
    "provider": "azure",
    "model": "text-embedding-3-large",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "engine": "<YOUR_ENGINE>",
    "apiVersion": "<YOUR_API_VERSION>",
    "apiType": "azure",
    "apiKey": "<MY_API_KEY>"
}
```

## 重排序模型

Azure OpenAI 当前没有提供任何重排序模型。

[点击这里](../../model-types/reranking.md) 查看重排序模型列表。

## 隐私

如果你想要使用 OpenAI 模型，但是担心隐私问题，你可以使用 Azure OpenAI 服务，它是符合 GDPR 和 HIPAA 的。

:::info[获取访问]
你需要申请 Azure OpenAI 服务的访问。响应时间通常是几天。

**[点击这里申请 Azure OpenAI 服务的访问](https://azure.microsoft.com/en-us/products/ai-services/openai-service)**
:::

## 通用模型配置

Azure OpenAI 需要配置一些额外的参数，例如模型引擎和 API 版本。

要在 _Azure AI Studio_ 查找这个信息，首先选择你想要连接的模型。然后访问 _Endpoint_ > _Target URI_ 。

例如， Target URI `<https://just-an-example.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2023-03-15-preview>` 匹配以下配置：

```json
{
  "title": "GPT-4o Azure",
  "model": "gpt-4o",
  "provider": "azure",
  "apiBase": "https://just-an-example.openai.azure.com",
  "apiType": "azure",
  "engine": "gpt-4o",
  "apiVersion": "2023-03-15-preview",
  "apiKey": "<MY_API_KEY>"
}
```
