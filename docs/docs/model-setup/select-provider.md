---
title: Select a provider
description: Swap out different LLM providers
keywords: [openai, anthropic, PaLM, ollama, ggml]
---

# Select a model provider

Continue makes it easy to swap out different LLM providers. You can either click the "+" button next to the model dropdown to configure in the GUI or manually add them to your `config.json`. Once you've done this, you will be able to switch between them in the model selection dropdown.

**In addition to selecting a model provider, you will need to figure out [what LLM to use](./select-model.md).**

## Local

You can run a model on your local computer using:

- [Ollama](../reference/Model%20Providers/ollama.md)
- [LM Studio](../reference/Model%20Providers/lmstudio.md)
- [Llama.cpp](../reference/Model%20Providers/llamacpp.md)
- [LocalAI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [Text generation web UI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [FastChat](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [llama-cpp-python](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples) (OpenAI compatible server)

Once you have it running, you will need to configure it in the GUI or manually add it to your `config.json`.

## Cloud

You can deploy a model in your [AWS](https://github.com/continuedev/deploy-os-code-llm#aws), [GCP](https://github.com/continuedev/deploy-os-code-llm#gcp), [Azure](https://github.com/continuedev/deploy-os-code-llm#azure), or [other clouds](https://github.com/continuedev/deploy-os-code-llm#others-2) using:

- [HuggingFace TGI](https://github.com/continuedev/deploy-os-code-llm#tgi)
- [vLLM](https://github.com/continuedev/deploy-os-code-llm#vllm)
- [SkyPilot](https://github.com/continuedev/deploy-os-code-llm#skypilot)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints) (OpenAI compatible API)

If the API you use is OpenAI-compatible, you will be able to use the "openai" provider in `config.json` and change the `apiBase` to point to the server. Otherwise, you may need to wire up a new LLM object in `config.ts`. Learn how to do this [here](configuration.md#defining-a-custom-llm-provider)

## SaaS

### Open-source LLMs

You can deploy open-source LLMs on a service using:

- [Together](../reference/Model%20Providers/togetherllm.md)
- [HuggingFace Inference Endpoints](../reference/Model%20Providers/huggingfaceinferenceapi.md)
- [Anyscale Endpoints](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [Replicate](../reference/Model%20Providers/replicatellm.md)
- [Deepinfra](../reference/Model%20Providers/deepinfra.md)

### Commercial LLMs

You can use commercial LLMs via APIs using:

- [OpenAI API](../reference/Model%20Providers/openai.md)
- [Azure OpenAI Service](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [Anthrophic API](../reference/Model%20Providers/anthropicllm.md)
- [Google PaLM API](../reference/Model%20Providers/googlepalmapi.md)
- [OpenAI free trial](../reference/Model%20Providers/freetrial.md)
- [Mistral API](../reference/Model%20Providers/mistral.md)
