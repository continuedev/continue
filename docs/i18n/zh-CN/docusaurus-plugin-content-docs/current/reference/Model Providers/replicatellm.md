# ReplicateLLM

Replicate 是一个好的选项，对于新发布的语言模型或你在他们平台上部署的模型。注册一个帐号 [这里](https://replicate.ai/) ，复制你的 API key ，然后从 [Replicate Streaming List](https://replicate.com/collections/streaming-language-models) 选择任何模型。修改 `~/.continue/config.json` 看起来像这样：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Replicate CodeLLama",
      "provider": "replicate",
      "model": "codellama-13b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

如果你没有指定 `model` 参数，它默认是 `replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781` 。

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Replicate.ts)
