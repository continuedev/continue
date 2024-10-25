---
title: Reranking model
description: Reranking model
keywords: [rerank]
sidebar_position: 4
---

A "reranking model" is trained to take two pieces of text (often a user question and a document) and return a relevancy score between 0 and 1, estimating how useful the document will be in answering the question. Rerankers are typically much smaller than LLMs, and will be extremely fast and cheap in comparison.

In Continue, reranking is used by [@Codebase](../deep-dives/codebase.md) in order to select the most relevant code snippets after vector search.

## Recommended reranking models

If you have the ability to use any model, we recommend `rerank-2` by Voyage AI, which is listed below along with the rest of the options for rerankers.

### Voyage AI

Voyage AI offers the best reranking model for code with their `rerank-2` model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="config.json"
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-2",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

### Cohere

See Cohere's documentation for rerankers [here](https://docs.cohere.com/docs/rerank-2).

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

If you only have access to a single LLM, then you can use it as a reranker. This is discouraged unless truly necessary, because it will be much more expensive and still less accurate than any of the above models trained specifically for the task. Note that this will not work if you are using a local model, for example with Ollama, because too many parallel requests need to be made.

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

The `"modelTitle"` field must match one of the models in your "models" array in config.json.

### Text Embeddings Inference

[Hugging Face Text Embeddings Inference](https://huggingface.co/docs/text-embeddings-inference/en/index) enables you to host your own [reranker endpoint](https://huggingface.github.io/text-embeddings-inference/#/Text%20Embeddings%20Inference/rerank). You can configure your reranker as follows:

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

### Free Trial (Voyage AI)

Continue offers a free trial of Voyage AI's reranking model.

```json title="config.json"
{
  "reranker": {
    "name": "free-trial"
  }
}
```
