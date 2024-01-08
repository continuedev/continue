# AnthropicLLM

To setup Anthropic, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Anthropic",
      "provider": "anthropic",
      "model": "claude-2",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

Claude 2 is not yet publicly released. You can request early access [here](https://www.anthropic.com/earlyaccess).

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Anthropic.ts)
