---
title: Reranking Providers
sidebar_label: 🏆 Reranking Providers
description: Overview of different reranking options available in Continue, including Cohere, Voyage AI, LLM, Hugging Face TEI, and free trial options.
---

The reranker plays a crucial role in refining the results retrieved from your codebase. It processes the initial set of results obtained through embeddings-based retrieval, improving their relevance and accuracy for your queries.

Continue offers several reranking options: `cohere`, `voyage`, `llm`, `hugginface-tei`, and `free-trial`, which can be configured in `config.json`.

## Cohere

See Cohere's documentation for rerankers [here](https://docs.cohere.com/docs/rerank-2).

```json title="~/.continue/config.json"
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

## Free Trial

Continue offers a free trial of Voyage AI's reranking model.

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "free-trial"
  }
}
```

## LLM

If you only have access to a single LLM, then you can use it as a reranker. This is discouraged unless truly necessary, because it will be much more expensive and still less accurate than any of the above models trained specifically for the task. Note that this will not work if you are using a local model, for example with Ollama, because too many parallel requests need to be made.

```json title="~/.continue/config.json"
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

## Text Embeddings Inference

[Hugging Face Text Embeddings Inference](https://huggingface.co/docs/text-embeddings-inference/en/index) enables you to host your own [reranker endpoint](https://huggingface.github.io/text-embeddings-inference/#/Text%20Embeddings%20Inference/rerank). You can configure your reranker as follows:

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "huggingface-tei",
    "params": {
        "apiBase": "http://localhost:8080",
        "truncate": true,
        "truncation_direction": "Right"
    }
  },
}
```

## Voyage AI

Voyage AI offers the best reranking model for code with their rerank-lite-1 model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-lite-1",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```
