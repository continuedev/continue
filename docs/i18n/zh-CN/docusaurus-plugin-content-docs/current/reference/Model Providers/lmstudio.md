# LM Studio

[LM Studio](https://lmstudio.ai) 是一个 Mac, Windows 和 Linux 的应用，它简单地在本地运行开源模型，并提供一个好的 UI 。为了开始使用 LM Studio ，从网站上下载，使用 UI 下载模型，然后启动本地推理服务器。 Continue 配置使用 `LMStudio` LLM 类：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "LM Studio",
      "provider": "lmstudio",
      "model": "llama2-7b"
    }
  ]
}
```

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/LMStudio.ts)
