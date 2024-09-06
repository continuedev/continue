---
title: Hugging Face Text Embeddings Inference
---

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
