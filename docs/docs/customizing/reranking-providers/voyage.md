---
title: Voyage AI
---

Voyage AI offers the best reranking model for code with their rerank-lite-1 model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="config.json"
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
