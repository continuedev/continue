# SambaNova Cloud

The SambaNova Cloud is a cloud platform for running large AI models with the world record Llama 3.1 70B/405B performance. You can follow the instructions in [this blog post](https://sambanova.ai/blog/accelerating-coding-with-sambanova-cloud?ref=blog.continue.dev) to configure your setup.

```json title="config.json"
{
  "models": [
    {
      "title": "SambaNova Llama 3.1 405B",
      "provider": "sambanova",
      "model": "llama3.1-405b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/SambaNova.ts)
