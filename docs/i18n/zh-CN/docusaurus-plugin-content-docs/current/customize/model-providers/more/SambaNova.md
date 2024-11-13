# SambaNova Cloud

SambaNova 云是一个运行大型 AI 模型的云平台，有 Llama 3.1 70B/405B 性能的世界记录。你可以在 [这里](https://cloud.sambanova.ai/) 登录，在最初的欢迎屏幕复制你的 API key ，然后在 [模型列表](https://community.sambanova.ai/t/quick-start-guide/104) 任何模型上点击 play 按钮。

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

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/SambaNova.ts)
