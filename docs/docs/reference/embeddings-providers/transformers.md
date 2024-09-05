---
title: Transformers.js
---

:::info
Note that Transformers.js is currently only available in VS Code
:::

[Transformers.js](https://huggingface.co/docs/transformers.js/index) is a JavaScript port of the popular [Transformers](https://huggingface.co/transformers/) library. It allows embeddings to be calculated locally in the browser (or in this case inside of the sidebar of your IDE). The model used is `all-MiniLM-L6-v2`, which is shipped alongside the Continue extension and generates embeddings of size 384.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "transformers.js"
  }
}
```
