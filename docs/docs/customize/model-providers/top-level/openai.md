---
title: OpenAI
slug: ../openai
---

:::info

You can get an API key from the [OpenAI console](https://platform.openai.com/account/api-keys)

:::

## Chat model

We recommend configuring **GPT-4o** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Autocomplete model

OpenAI currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

We recommend configuring **text-embedding-3-large** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiKey": "[API_KEY]"
  }
}
```

## Reranking model

OpenAI currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.

## OpenAI compatible servers / APIs

OpenAI compatible servers

- [KoboldCpp](https://github.com/lostruins/koboldcpp)
- [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
- [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
- [LocalAI](https://localai.io/basics/getting_started/)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples)
- [vLLM](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html)

OpenAI compatible APIs

- [Anyscale Endpoints](https://github.com/continuedev/deploy-os-code-llm#others)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints)

If you are using an OpenAI compatible server / API, you can change the `apiBase` like this:

```json title="config.json"
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
