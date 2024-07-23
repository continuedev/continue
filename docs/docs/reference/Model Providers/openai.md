# OpenAI

The OpenAI class can be used to access OpenAI models like GPT-4, GPT-4 Turbo, and GPT-3.5 Turbo.

## OpenAI compatible servers / APIs

OpenAI compatible servers

- [KoboldCpp](https://github.com/lostruins/koboldcpp)
- [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
- [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
- [LocalAI](https://localai.io/basics/getting_started/)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples)
- [vLLM](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html) [^1]

OpenAI compatible APIs

- [Anyscale Endpoints](https://github.com/continuedev/deploy-os-code-llm#others)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints)

If you are [using an OpenAI compatible server / API](../../setup/select-provider#local), you can change the `apiBase` like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "OpenAI-compatible server / API",
      "provider": "openai",
      "model": "MODEL_NAME",
      "apiKey": "EMPTY",
      "apiBase": "http://localhost:8000/v1"
    }
  ]
}
```

To force usage of `chat/completions` instead of `completions` endpoint you can set

```json
"useLegacyCompletionsEndpoint": false
```

[^1]: Use the [Vllm Model Provider](./vllm.md) instead.


[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/OpenAI.ts)
