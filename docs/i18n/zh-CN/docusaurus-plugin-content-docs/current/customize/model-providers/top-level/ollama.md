---
title: Ollama
slug: ../ollama
---

## 聊天模型

我们推荐配置 **Llama3.1 8B** 作为你的聊天模型。

```json title="config.json"
{
  "models": [
    {
      "title": "Llama3.1 8B",
      "provider": "ollama",
      "model": "llama3.1:8b"
    }
  ]
}
```

## 自动补全模型

我们推荐配置 **StarCoder2 3B** 作为你的自动补全模型。

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "StarCoder2 3B",
    "provider": "ollama",
    "model": "starcoder2:3b"
  }
}
```

## 嵌入模型

我们推荐配置 **Nomic Embed Text** 作为你的嵌入模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text"
  }
}
```

## 重排序模型

Ollama 当前没有提供任何重排序模型。

[点击这里](../../model-types/reranking.md) 查看重排序模型提供者列表。
