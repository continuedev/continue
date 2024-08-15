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
  ],
  "disablePromptCaching": false
}
```

## Prompt Caching (Beta)

Continue now supports prompt caching for Anthropic models by default. This feature can significantly reduce costs for multi-turn conversations. [Read more about prompt caching and its potential savings here](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#how-many-cache-breakpoints-can-i-use).

To disable caching for a specific query, start your message with "/nocache". For long, single-shot analyses or if you expect inactivity for over 5 minutes, using "/nocache" is recommended.

To force caching on a per-query basis when globally disabled, use "/cache" at the start of your message.

We're ready for potential savings with Claude 3.5 Opus and beyond!

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Anthropic.ts)