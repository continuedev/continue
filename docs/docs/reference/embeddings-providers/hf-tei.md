---
title: Hugging Face Text Embeddings Inference
---

[Hugging Face Text Embeddings Inference](https://huggingface.co/docs/text-embeddings-inference/en/index) enables you to host your own embeddings endpoint. You can configure embeddings to use your endpoint as follows:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "huggingface-tei",
    "apiBase": "http://localhost:8080"
  }
}
```
