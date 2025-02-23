# LM Studio

[LM Studio](https://lmstudio.ai) 是一个 Mac, Windows 和 Linux 的应用，让本地运行开源模型更简单，并提供很好的 UI 。要开始使用 LM Studio ，从网站上下载它，使用 UI 下载一个模型，然后打开本地推理服务器。 Continue 可以配置来使用 `LMStudio` LLM 类：

```json title="config.json"
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

## 设置一个远程实例

要配置一个 LM Studio 的远程实例，在 config.json 中，添加 `"apiBase"` 属性到你的模型中：

```json title="config.json"
{
  "title": "LM Studio",
  "model": "codestral",
  "provider": "lmstudio",
  "apiBase": "http://x.x.x.x:1234/v1/"
}
```

`apiBase` 现在将会代替默认的 `http://localhost:1234/v1` 。

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/LMStudio.ts)
