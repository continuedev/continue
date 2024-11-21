# Kindo

Kindo 对你的机构 AI 操作提供集中控制，当支持不同的商业和开源模型时，确保数据安全和内部原则兼容。要开始使用，在 [这里](https://app.kindo.ai/) 注册，在 [API keys 页面](https://app.kindo.ai/settings/api) 创建你的 API key ，在 [plugins 标签页](https://app.kindo.ai/plugins) 中，从支持的模型列表中选择一个模型。

## 配置示例

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "kindo",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "<KINDO_API_KEY>"
    }
  ]
}
```

## tab 自动补全配置示例

```json title="config.json"
{
  "tabAutocompleteModel": [
    {
      "title": "WhiteRabbitNeo",
      "provider": "kindo",
      "model": "/models/WhiteRabbitNeo-33B-DeepSeekCoder",
      "apiKey": "<KINDO_API_KEY>"
    },
    {
      "title": "DeepSeek",
      "provider": "kindo",
      "model": "deepseek-ai/deepseek-coder-33b-instruct",
      "apiKey": "<KINDO_API_KEY>"
    }
  ]
}
```

## 安全性

要更新你的机构模型访问，在 [安全性设置](https://app.kindo.ai/security-settings) 中调整控制。
