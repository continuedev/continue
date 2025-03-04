# Cohere

在使用 Cohere 之前，访问 [Cohere dashboard](https://dashboard.cohere.com/api-keys) 创建 API key 。

## 聊天模型

我们推荐配置 **Command-R Plus** 作为你的聊天模型。

```json title="config.json"
{
  "models": [
    {
      "title": "Cohere",
      "provider": "cohere",
      "model": "command-r-plus",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

## 自动补全模型

Cohere 当前没有提供任何自动补全模型。

[点击这里](../../model-roles/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

我们推荐配置 **embed-english-v3.0** 作为你的嵌入模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "cohere",
    "model": "embed-english-v3.0",
    "apiKey": "<COHERE_API_KEY>"
  }
}
```

## 重排序模型

我们推荐配置 **rerank-english-v3.0** 作为你的重排序模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "cohere",
    "params": {
      "model": "rerank-english-v3.0",
      "apiKey": "<COHERE_API_KEY>"
    }
  }
}
```
