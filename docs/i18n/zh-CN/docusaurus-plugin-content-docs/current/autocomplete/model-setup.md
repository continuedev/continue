---
title: 模型设置
description: 自动补全 \- 模型设置
keywords: [模型, 自动补全]
sidebar_position: 2
---

## 最好的总体体验

为了最好的自动补全体验，我们推荐通过 [Mistral API](https://console.mistral.ai/) 使用 Codestral 。这个模型提供高质量的补全，使用极好的代码上下文理解：

```json title="config.json""
{
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "YOUR_API_KEY"
  }
}
```

:::tip[Codestral API Key]
Codestral 的 API key 和通常的 Mistral API 是不同的。如果你使用 Codestral ，你可能想要一个 Codestral API key ，但是如果你想分享 key 给团队或其他人想要使用 `api.mistral.ai` ，那么确保在你的 `tabAutocompleteModel` 中设置 `"apiBase": "https://api.mistral.ai/v1"` 。
:::

## 本地的，离线的/自托管的体验

对于倾向于本地执行或自托管的， `StarCoder2-3b` 提供了一个对于大多数用户性能和质量的平衡：

```json title="config.json""
{
  "tabAutocompleteModel": {
    "title": "StarCoder2-3b",
    "model": "starcoder2:3b",
    "provider": "ollama"
  }
}
```

## 可替代的体验

- 补全太慢？在更弱的机器上，试试 `deepseek-coder:1.3b-base` 更快的补全
- 有更多的计算？使用 `deepseek-coder:6.7b-base` 获取可能更高质量的建议

:::note
对于 LM Studio 用户，导航到 "My Models" 章节，找到你想要的模型，复制它的路径 (例如， second-state/StarCoder2-3B-GGUF/starcoder2-3b-Q8_0.gguf) 。使用这个路径作为你的配置中的 `model` 值。
:::

## 其他体验

有很多更多的模型或提供者可以用来补全。在 [这里](../customize/model-types/autocomplete.md) 查看它们。
