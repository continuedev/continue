---
title: Ollama
---

[Ollama](https://ollama.ai) is the easiest way to get up and running with open-source language models. It provides an entirely local REST API for working with LLMs, including generating embeddings. We recommend using an embeddings model like `nomic-embed-text`:

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "apiBase": "http://localhost:11434" // optional, defaults to http://localhost:11434
  }
}
```
