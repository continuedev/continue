---
title: 重排序模型
description: 重排序模型
keywords: [重排序]
sidebar_position: 4
---

"重排序模型" 是训练为采用两部分文本（通常一个用户问题和一个文档）并返回 0 和 1 之间的相关性得分，估算文档回答问题的可用性。重排序通常远小于 LLM ，在比较中非常快速和便宜。

在 Continue 中，重排序用在 [@Codebase](../deep-dives/codebase.md) ，为了在向量搜索之后选择最想关的代码片断。

## 推荐的重排序模型

如果你有使用任何模型的能力，我们推荐 Voyage AI 的 `rerank-1` ，它独立列在下面，和其他的重排序选项一起。

### Voyage AI

Voyage AI 提供代码最好的重排序模型， 使用他们的 `rerank-1` 模型。在从 [这里](https://www.voyageai.com/) 获取 API key 后，你可以像这样配置：

```json title="config.json"
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-1",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

### Cohere

在 [这里](https://docs.cohere.com/docs/rerank-2) 查看 Cohere 对于重排序的文档。

```json title="config.json"
{
  "reranker": {
    "name": "cohere",
    "params": {
      "model": "rerank-english-v3.0",
      "apiKey": "<COHERE_API_KEY>"
    }
  }
}
```

### LLM

如果你只能访问一个单独的 LLM ，那么你可以使用它作为重排器。这是不推荐的，除非真正需要，因为它将会更昂贵，并且仍然比上面这些特殊任务训练的模型慢。注意，如果你使用本地的模型，这将不会工作，例如使用 Ollama ，因为会创建太多的并发请求。

```json title="config.json"
{
  "reranker": {
    "name": "llm",
    "params": {
      "modelTitle": "My Model Title"
    }
  }
}
```

`"modelTitle"` 字段必须匹配在你的 `config.json` 中 "models" 列表中的一个模型。

### 文本嵌入推理

[Hugging Face 文本嵌入推理](https://huggingface.co/docs/text-embeddings-inference/en/index) 允许你托管自己的 [重排器端点](https://huggingface.github.io/text-embeddings-inference/#/Text%20Embeddings%20Inference/rerank) 。你可以像这样配置你的重排器：

```json title="config.json"
{
  "reranker": {
    "name": "huggingface-tei",
    "params": {
      "apiBase": "http://localhost:8080",
      "truncate": true,
      "truncation_direction": "Right"
    }
  }
}
```

### 免费试用 (Voyage AI)

Continue 提供 Voyage AI 重排序模型的免费试用。

```json title="config.json"
{
  "reranker": {
    "name": "free-trial"
  }
}
```
