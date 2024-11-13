---
title: OpenAI
slug: ../openai
---

:::info
你可以从 [OpenAI 控制台](https://platform.openai.com/account/api-keys) 获取 API key
:::

## 聊天模型

我们推荐配置 **GPT-4o** 作为你的聊天模型。

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

## 自动补全模型

OpenAI 当前没有提供任何自动补全模型。

[点击这里](../../model-types/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

我们推荐配置 **text-embedding-3-large** 作为你的嵌入模型。

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiKey": "[API_KEY]"
  }
}
```

## 重排序模型

OpenAI 当前没有提供任何重排序模型。

[点击这里](../../model-types/reranking.md) 查看重排序模型提供者列表。

## OpenAI 兼容服务器 / API

OpenAI 兼容服务器

- [KoboldCpp](https://github.com/lostruins/koboldcpp)
- [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
- [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
- [LocalAI](https://localai.io/basics/getting_started/)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples)
- [vLLM](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html)

OpenAI 兼容 API

- [Anyscale Endpoints](https://github.com/continuedev/deploy-os-code-llm#others)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints)

如果你使用 OpenAI 兼容服务器 / API ，你可以像这样修改 `apiBase` ：

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

为了使用 `chat/completions` 代替 `completions` 端点，你可以设置

```json
"useLegacyCompletionsEndpoint": false
```
