# SambaNova Cloud

The SambaNova Cloud is a cloud platform for running large AI models with the world record Llama 3.1 70B/405B performance. You can sign up [here](https://cloud.sambanova.ai/), copy your API key on the initial welcome screen, and then hit the play button on any model from the [model list](https://community.sambanova.ai/t/quick-start-guide/104).

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
