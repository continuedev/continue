---
title: 嵌入模型
description: 嵌入模型
keywords: [嵌入]
sidebar_position: 3
---

"嵌入模型" 是训练用来转换一部分文本为向量，可以在之后快速的与其他向量比较，决定部分文本的相似性。嵌入模型通常比 LLM 小得多，在比较中非常快速和便宜。

在 Continue 中，嵌入是在索引是生成的，然后由 [@Codebase](../deep-dives/codebase.md) 使用，来实现对你的代码库的相似性搜索。

## 推荐的嵌入模型

如果你有使用任何模型的能力，我们推荐 `voyage-code-3` ，它独立列在下面，和其他的嵌入模型选项一起。

如果你想本地生成嵌入，我们推荐通过 [Ollama](../model-providers/top-level/ollama.md#嵌入模型) 使用 `nomic-embed-text` 。

### Voyage AI

在从 [这里](https://www.voyageai.com/) 获取 API key 后，你可以像这样配置：

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "voyage",
    "model": "voyage-code-3",
    "apiKey": "<VOYAGE_API_KEY>"
  }
}
```

### Ollama

查看 [这个](../model-providers/top-level/ollama.md#嵌入模型) 获取如何使用 Ollama 来嵌入的指令。

### Transformers.js (当前只有 VS Code)

[Transformers.js](https://huggingface.co/docs/transformers.js/index) 是流行的 [Transformers](https://huggingface.co/transformers/) 库一个 JavaScript 移植。它允许嵌入完全在本地计算。模型使用的是 `all-MiniLM-L6-v2` ，与 Continue 扩展一起，当你没有明确配置嵌入提供者时，作为默认使用。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "transformers.js"
  }
}
```

### 文本嵌入推理

[Hugging Face 文本嵌入推理](https://huggingface.co/docs/text-embeddings-inference/en/index) 允许你托管自己的嵌入端点。你可以如下配置嵌入使用自己的端点：

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "huggingface-tei",
    "apiBase": "http://localhost:8080"
  }
}
```

### OpenAI

查看 [这里](../model-providers/top-level/openai.md#嵌入模型) 获取如何使用 OpenAI 嵌入的指令。

### Cohere

查看 [这里](../model-providers/more/cohere.md#嵌入模型) 获取如何使用 Cohere 嵌入的指令。

### Gemini

查看 [这里](../model-providers/top-level/gemini.md#嵌入模型) 获取如何使用 Gemini 嵌入的指令。
