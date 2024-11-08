# LM Studio

[LM Studio](https://lmstudio.ai) is an application for Mac, Windows, and Linux that makes it easy to locally run open-source models and comes with a great UI. To get started with LM Studio, download from the website, use the UI to download a model, and then start the local inference server. Continue can then be configured to use the `LMStudio` LLM class:

```json title="config.json"
{
  "models": [
    {
      "title": "LM Studio",
      "provider": "lmstudio",
      "model": "llama2-7b"
    }
  ]
}
```

### Embeddings model

LMStudio supports embeddings endpoints, and comes with the `nomic-ai/nomic-embed-text-v1.5-GGUF` model (as of Nov 2024, check your models)

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "lmstudio",
    "model": "nomic-ai/nomic-embed-text-v1.5-GGUF"
  }
}
```

## Setting up a remote instance

To configure a remote instance of LM Studio, add the `"apiBase"` property to your model in config.json:

```json title="config.json"
{
  "title": "LM Studio",
  "model": "codestral",
  "provider": "lmstudio",
  "apiBase": "http://x.x.x.x:1234/v1/"
}
```

This `apiBase` will now be used instead of the default `http://localhost:1234/v1`.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/LMStudio.ts)
