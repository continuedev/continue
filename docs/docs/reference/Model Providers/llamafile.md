# Llamafile

A [llamafile](https://github.com/Mozilla-Ocho/llamafile#readme) is a self-contained binary that can run an open-source LLM. You can configure this provider in your config.json as follows:

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

Optionally, you can set the `llamafile_command` property, which will be run to start the llamafile if it isn't already running on port 8080. Be sure to use an absolute path to the llamafile binary. For example: `/Users/yourusername/mistral-7b-instruct-v0.1-Q4_K_M-server.llamafile`.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Llamafile.ts)
