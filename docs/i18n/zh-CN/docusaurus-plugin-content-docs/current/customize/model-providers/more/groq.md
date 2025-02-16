# Groq

:::info

检查你选择的模型是否仍然支持，通过查询 [模型文档](https://console.groq.com/docs/models) 。如果一个模型被废弃，你可能遇到 404 错误，当尝试使用它时。

:::

Groq 提供开源语言模型最快的可用推理，包含整个 Llama 3.1 家族。

1. 从 [这里](https://console.groq.com/keys) 获取 API key
2. 像这样更新你的 Continue 配置文件：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.3 70b Versatile",
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "apiKey": "<API_KEY>"
    }
  ]
}
```
