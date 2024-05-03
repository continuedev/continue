# Llamafile

[llamafile](https://github.com/Mozilla-Ocho/llamafile#readme) 是一个自包含的二进制文件，可以运行开源 LLM 。你可以在 `config.json` 中配置这个提供者如下：

```json title="~/.continue/config.json"
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

可选的，你可以设置 `llamafile_command` 属性，它将运行启动 llamafile ，如果它没有运行在 8080 端口。确认使用 llamafile 二进制文件的绝对路径。例如： `/Users/yourusername/mistral-7b-instruct-v0.1-Q4_K_M-server.llamafile` 。

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Llamafile.ts)
