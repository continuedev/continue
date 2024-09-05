---
title: Voyage AI
---

Voyage AI offers the best embeddings for code with their voyage-code-2 model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "voyage-code-2",
    "apiBase": "https://api.voyageai.com/v1/",
    "apiKey": "<VOYAGE_API_KEY>"
  }
}
```
