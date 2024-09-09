# LlamaCpp

Run the llama.cpp server binary to start the API server. If running on a remote server, be sure to set host to 0.0.0.0:

```shell
.\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\meta\llama\codellama-7b-instruct.Q8_0.gguf
```

After it's up and running, change `~/.continue/config.json` to look like this:

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

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/LlamaCpp.ts)
