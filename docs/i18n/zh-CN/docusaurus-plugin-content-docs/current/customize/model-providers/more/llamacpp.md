# LlamaCpp

运行 llama.cpp server 二进制文件打开 API 服务器。如果你运行一个远程服务器，确保设置 host 为 0.0.0.0 ：

```shell
.\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\meta\llama\codellama-7b-instruct.Q8_0.gguf
```

在它设置和运行之后，修改 `~/.continue/config.json` 像这样：

```json title="config.json"
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

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/LlamaCpp.ts)
