# Llamafile

[llamafile](https://github.com/Mozilla-Ocho/llamafile#readme) 是一个自包含的二进制文件，可以运行一个开源 LLM 。你可以像下面这样在 config.json 配置这个提供者：

```json title="config.json"
{
  "models": [
    {
      "title": "Llamafile",
      "provider": "llamafile",
      "model": "mistral-7b"
    }
  ]
}
```

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Llamafile.ts)
