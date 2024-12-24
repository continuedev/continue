# Novita

Novita API 是一个运行大 AI 模型的云平台。你可以在 [这里](https://novita.ai/user/login?&redirect=/&utm_source=github_continuedev) 注册，在最初欢迎屏幕复制你的 API key ，然后在 [Novita 模型列表](https://novita.ai/llm-api?utm_source=github_continuedev&utm_medium=github_readme&utm_campaign=link) 的任何模型上点击 Try it now 按钮。修改 `~/.continue/config.json` 像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 8b",
      "provider": "Novita",
      "model": "meta-llama/llama-3.1-8b-instruct",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Novita.ts)
