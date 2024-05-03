# OpenAI

OpenAI 类可以用来访问 OpenAI 模型，比如 GPT-4, GPT-4 Turbo 和 GPT-3.5 Turbo 。

### Azure OpenAI 服务

如果你想要使用 OpenAI 模型，但是担心隐私问题，你可以使用 Azure OpenAI 服务，它是符合 GDPR 和 HIPAA 的。在接受访问 [这里](https://azure.microsoft.com/en-us/products/ai-services/openai-service) 之后，你通常会在几天之内收到回复。一旦你可以访问，在 `config.json` 中设置一个模型，像这样：

```json
"models": [{
    "title": "Azure OpenAI",
    "provider": "openai",
    "model": "gpt-4",
    "apiBase": "https://my-azure-openai-instance.openai.azure.com/",
    "engine": "my-azure-openai-deployment",
    "apiVersion": "2023-07-01-preview",
    "apiType": "azure",
    "apiKey": "<MY_API_KEY>"
}]
```

找到这个信息最简单的方式是在 Azure OpenAI portal 的聊天操场。在 "Chat Session" 部分，点击 "View Code" 来查看每个参数。

### OpenAI 兼容的服务器 / API

OpenAI 兼容的服务器

- [KoboldCpp](https://github.com/lostruins/koboldcpp)
- [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
- [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
- [LocalAI](https://localai.io/basics/getting_started/)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples)

OpenAI 兼容的 API

- [Anyscale Endpoints](https://github.com/continuedev/deploy-os-code-llm#others)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints)

如果你 [使用 OpenAI 兼容的服务器 / API](../../model-setup/select-provider#local) ，你可以修改 `apiBase` 像这样：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "OpenAI-compatible server / API",
      "provider": "openai",
      "model": "MODEL_NAME",
      "apiKey": "EMPTY",
      "apiBase": "http://localhost:8000"
    }
  ]
}
```

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/OpenAI.ts)
