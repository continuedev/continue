# Together

Together API 是一个运行大 AI 模型的云平台。你可以在 [这里](https://api.together.xyz/signup) 注册，在最初欢迎屏幕复制你的 API key ，然后在 [Together 模型列表](https://docs.together.ai/docs/models-inference) 的任何模型上点击 play 按钮。修改 `~/.continue/config.json` 像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Together CodeLlama",
      "provider": "together",
      "model": "codellama-13b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Together.ts)
