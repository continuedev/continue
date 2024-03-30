# GooglePaLMAPI

Google PaLM API 目前处于 beta 状态。你可以 [在 Google MakerSuite 创建一个 API key](https://makersuite.google.com/u/2/app/apikey) ，使用 `chat-bison-001` 模型或 `gemini-pro` 。修改 `~/.continue/config.json` 看起来像这样：

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

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/GooglePalm.ts)
