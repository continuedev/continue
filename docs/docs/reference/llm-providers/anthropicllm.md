# Anthropic

To setup Anthropic, obtain an API key from [here](https://www.anthropic.com/api) and add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Anthropic",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Anthropic.ts)

## Prompt caching

Anthropic supports [prompt caching with Claude](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching).

Currently, we only allow caching of the system message. To enable this feature, update your your model configuration with `"cacheSystemMessage": true`:

```json
{
  "models": [
    {
      // Enable prompt caching
      "cacheSystemMessage": true,
      "title": "Anthropic",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```
