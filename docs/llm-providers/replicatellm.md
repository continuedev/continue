# ReplicateLLM

Replicate is a great option for newly released language models or models that you've deployed through their platform. Sign up for an account [here](https://replicate.ai/), copy your API key, and then select any model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models). Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Replicate CodeLLama",
      "provider": "replicate",
      "model": "codellama-13b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

If you don't specify the `model` parameter, it will default to `replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781`.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Replicate.ts)
