# LlamaCpp

运行 llama.cpp server 二进制文件来启动 API 服务器。如果在远程服务器上运行，确认设置 host 为 0.0.0.0 ：

```shell
.\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\meta\llama\codellama-7b-instruct.Q8_0.gguf
```

在它启动运行之后，修改 `~/.continue/config.json` 看起来像这样：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Llama CPP",
      "provider": "llama.cpp",
      "model": "MODEL_NAME",
      "apiBase": "http://localhost:8080"
    }
  ]
}
```

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/LlamaCpp.ts)
