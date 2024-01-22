# Mistral API

The [Mistral](https://mistral.ai) API provides hosted access to their models, including Mistral-7b, Mixtral, and the very capable mistral-medium. After you obtain your API key [here](https://docs.mistral.ai/), Continue can be configured as shown here:

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

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Mistral.ts)
