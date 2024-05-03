# TogetherLLM

Together API 是一个运行大 AI 模型的云平台。你可以注册 [这里](https://api.together.xyz/signup) ，从最初的欢迎页复制你的 API key ，然后在任何模型点击 play 按钮， [Together 模型列表](https://docs.together.ai/docs/models-inference) 。修改 `~/.continue/config.json` 看起来像这样：

```json title="~/.continue/config.json"
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

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Together.ts)
