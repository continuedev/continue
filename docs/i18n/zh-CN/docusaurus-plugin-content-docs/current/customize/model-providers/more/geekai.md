# GeekAI

GeekAI 是一个多块好省的 AI 模型评测与代理平台，可以自动为你的应用场景调度最便宜可用的 AI 模型。你可以在 [这里](https://geekai.dev/login) 注册，在 [令牌管理页面](https://geekai.dev/user/api_keys) 创建你的 API key ，然后从 [模型广场](https://geekai.dev/models) 中选择一个模型（通过模型名称）。

修改 `~/.continue/config.json` 如下：

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "geekai",
      "model": "claude-3-5-sonnet-latest",
      "apiBase": "https://geekai.dev/api/v1",
      "apiKey": "..."
    }
  ]
}
```

你可以在 [API文档](https://geekai.dev/docs/api) 了解更多可用的设置。
