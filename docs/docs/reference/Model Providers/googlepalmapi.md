# GooglePaLMAPI

The Google PaLM API is currently in beta. You can [create an API key in Google MakerSuite](https://makersuite.google.com/u/2/app/apikey) and use either the `chat-bison-001` model or `gemini-pro`. Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Gemini Pro",
      "provider": "google-palm",
      "model": "gemini-pro",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/GooglePalm.ts)
