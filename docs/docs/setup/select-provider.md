---
title: Select providers
description: Configure LLM providers
keywords: [openai, anthropic, gemini, ollama, ggml]
---

# Select providers

Continue makes it easy to use different providers for serving your chat, autocomplete, and embeddings models.

To select the ones you want to use, add them to your `config.json`.

## Self-hosted

### Local

You can run a model on your local computer using:

- [Ollama](../reference/Model%20Providers/ollama.md)
- [LM Studio](../reference/Model%20Providers/lmstudio.md)
- [Llama.cpp](../reference/Model%20Providers/llamacpp.md)
- [KoboldCpp](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [llamafile](../reference/Model%20Providers/llamafile) ((OpenAI compatible server)
- [LocalAI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [Text generation web UI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [FastChat](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [llama-cpp-python](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples) (OpenAI compatible server)

### Remote

You can deploy a model in your [AWS](https://github.com/continuedev/deploy-os-code-llm#aws), [GCP](https://github.com/continuedev/deploy-os-code-llm#gcp), [Azure](https://github.com/continuedev/deploy-os-code-llm#azure), or [other clouds](https://github.com/continuedev/deploy-os-code-llm#others-2) using:

- [HuggingFace TGI](https://github.com/continuedev/deploy-os-code-llm#tgi)
- [vLLM](https://github.com/continuedev/deploy-os-code-llm#vllm)
- [SkyPilot](https://github.com/continuedev/deploy-os-code-llm#skypilot)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints) (OpenAI compatible API)

## SaaS

You can access both open-source and commercial LLMs via:
* [OpenRouter](../reference/Model%20Providers/openrouter.md)

### Open-source models

You can deploy open-source LLMs on a service using:

- [Together](../reference/Model%20Providers/togetherllm.md)
- [HuggingFace Inference Endpoints](../reference/Model%20Providers/huggingfaceinferenceapi.md)
- [Anyscale Endpoints](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [Replicate](../reference/Model%20Providers/replicatellm.md)
- [Deepinfra](../reference/Model%20Providers/deepinfra.md)
- [Groq](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [AWS Bedrock](../reference/Model%20Providers/bedrock.md)

### Commercial models

You can use commercial LLMs via APIs using:

- [Anthrophic API](../reference/Model%20Providers/anthropicllm.md)
- [OpenAI API](../reference/Model%20Providers/openai.md)
- [Azure OpenAI Service](../reference/Model%20Providers/openai.md)
- [Google Gemini API](../reference/Model%20Providers/geminiapi.md)
- [Mistral API](../reference/Model%20Providers/mistral.md)
- [Voyage AI API](../walkthroughs/codebase-embeddings.md#openai)
- [Cohere API](../reference/Model%20Providers/cohere.md)

**In addition to selecting providers, you will need to figure out [what models to use](./select-model.md).**
