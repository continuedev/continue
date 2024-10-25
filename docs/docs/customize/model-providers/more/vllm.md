# vLLM

Run the OpenAI-compatible server by vLLM using `vllm serve`. See their [server documentation](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html) and the [engine arguments documentation](https://docs.vllm.ai/en/latest/models/engine_args.html).

```shell
vllm serve NousResearch/Meta-Llama-3-8B-Instruct --max-model-len 1024
```

The continue implementation uses [OpenAI](../top-level/openai.md) under the hood and automatically selects the available model. You only need to set the `apiBase` like this:

```json title="config.json"
{
  "models": [
    {
      "title": "My vLLM OpenAI-compatible server",
      "apiBase": "http://localhost:8000/v1"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Vllm.ts)
