# Anthropic

To setup Anthropic, obtain an API key from [here](https://www.anthropic.com/api) and add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Anthropic",
      "provider": "anthropic",
      "model": "claude-3-opus-20240229",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Anthropic.ts)
