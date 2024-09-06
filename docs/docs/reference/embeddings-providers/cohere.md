---
title: Cohere
---

Configuration for the `embed-english-v3.0` model. This is the default.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "cohere",
    "model": "embed-english-v3.0",
    "apiKey": "<COHERE_API_KEY>"
  }
}
```

See Cohere's [embeddings](https://docs.cohere.com/docs/embed-2) for available models. Only embedding models v3 and higher are supported.
