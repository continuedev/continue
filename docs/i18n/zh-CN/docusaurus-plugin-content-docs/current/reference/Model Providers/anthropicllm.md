# AnthropicLLM

为了设置 Anthropic ，将以下添加到你的 `config.json` 文件中：

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

Claude 2 不是公开发布的。你可以请求提前访问 [这里](https://www.anthropic.com/earlyaccess) 。

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Anthropic.ts)
