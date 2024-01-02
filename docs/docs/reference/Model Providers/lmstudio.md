# LM Studio

[LM Studio](https://lmstudio.ai) is an application for Mac, Windows, and Linux that makes it easy to locally run open-source models and comes with a great UI. To get started with LM Studio, download from the website, use the UI to download a model, and then start the local inference server. Continue can then be configured to use the `LMStudio` LLM class:

```json title="~/.continue/config.json"
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

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/LMStudio.ts)
