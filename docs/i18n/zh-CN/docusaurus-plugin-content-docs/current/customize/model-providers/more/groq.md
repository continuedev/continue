# Groq

Groq 提供开源语言模型最快的可用推理，包含整个 Llama 3.1 家族。

1. 从 [这里](https://console.groq.com/keys) 获取 API key
2. 像这样更新你的 Continue 配置文件：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 405b",
      "provider": "groq",
      "model": "llama3.1-405b",
      "apiKey": "<API_KEY>"
    }
  ]
}
```
