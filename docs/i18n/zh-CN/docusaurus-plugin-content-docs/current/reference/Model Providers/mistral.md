# Mistral API

[Mistral](https://mistral.ai) API 提供托管访问他们的模型，包括 Mistral-7b, Mixtral, 以及能力非常强的 mistral-medium 。在你获取你的 API key [这里](https://docs.mistral.ai/) 之后， Continue 可以配置像这样：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "provider": "mistral",
      "title": "Mistral Small",
      "model": "mistral-small",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Mistral.ts)
