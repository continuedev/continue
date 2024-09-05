---
title: Gemini
---

Gemini's _Text Embedding_ model is optimized for creating embeddings with 768 dimensions for text of up to 2,048 tokens.

As of May 2024, the only available embedding model from Gemini is [`text-embedding-004`](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding-and-embedding).

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "gemini",
    "apiKey": "<GEMINI_API_KEY>"
  }
}
```
