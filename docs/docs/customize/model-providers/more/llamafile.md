# Llamafile

A [llamafile](https://github.com/Mozilla-Ocho/llamafile#readme) is a self-contained binary that can run an open-source LLM. You can configure this provider in your config.json as follows:

```json title="config.json"
{
  "models": [
    {
      "title": "Llamafile",
      "provider": "llamafile",
      "model": "mistral-7b"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Llamafile.ts)
