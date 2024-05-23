# Gemini API

The Google Gemini API is currently in beta. You can [create an API key in Google AI Studio](https://aistudio.google.com) and use `gemini-1.5-pro-latest`. Change `~/.continue/config.json` to include the following entry in the "models" array:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Gemini Pro",
      "provider": "gemini",
      "model": "gemini-1.5-pro-latest",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

Google has also released a more lightweight version of the model that still has a one-million-token context window and multimodal capabilities named Gemini Flash. It can be accessed by adding an entry in the models array similar to the above, but substituting "flash" for "pro" in the `title` and `model` values.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Gemini.ts)
