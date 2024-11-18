# vLLM

通过 vLLM 使用 `vllm serve` 运行 OpenAI-兼用 服务器。查看他们的 [服务器文档](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html) 和 [引擎参数文档](https://docs.vllm.ai/en/latest/models/engine_args.html) 。

```shell
vllm serve NousResearch/Meta-Llama-3-8B-Instruct --max-model-len 1024
```

Continue 底层实现使用 [OpenAI](../top-level/openai.md) 并自动选择可用的模型。你只需要设置 `apiBase` ，像这样：

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

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Vllm.ts)
