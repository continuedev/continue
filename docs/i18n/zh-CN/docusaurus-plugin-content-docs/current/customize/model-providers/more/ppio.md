# PPIO

[PPIO 派欧云](https://ppinfra.com?utm_source=github_continuedev) 提供稳定、高性价比的开源模型 API 服务，支持 DeepSeek 全系列、Llama、Qwen 等行业领先大模型。你可以在 [这里](https://ppinfra.com/user/login?utm_source=github_continuedev) 注册，在 [API 密钥管理](https://ppinfra.com/settings/key-management?utm_source=github_continuedev) 复制你的 API key ，然后在 [PPIO 模型列表](https://ppinfra.com/llm-api?utm_source=github_continuedev) 的任何模型上点击 '立即使用' 按钮。修改 `~/.continue/config.json` 像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 8b",
      "provider": "ppio",
      "model": "meta-llama/llama-3.1-8b-instruct",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/PPIO.ts)
