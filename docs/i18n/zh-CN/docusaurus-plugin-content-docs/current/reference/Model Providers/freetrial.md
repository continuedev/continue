# FreeTrial

使用 `FreeTrial` 提供者，新用户可以试用 Continue ，使用一个代理服务器访问 GPT-4 ，使用我们的  API key 安全地访问 OpenAI 。 Continue 应该只在你第一次在 VS Code 中安装扩展时可用。

一旦你正常地使用 Continue ，你需要添加 OpenAI API key 访问 GPT-4 ，通过以下步骤：

1. 从 https://platform.openai.com/account/api-keys 复制 API key 
2. 打开 `~/.continue/config.json` 。你可以在 Continue 中使用 `/config` 命令来做这个
3. 修改 LLM 看起来像这样：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai",
      "model": "gpt-4",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/FreeTrial.ts)
