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
- [LM Studio](../reference/Model%20Providers/ggml.md)
- [Llama.cpp](../reference/Model%20Providers/llamacpp.md)
- [LocalAI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [Text generation web UI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [FastChat](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [llama-cpp-python](../reference/Model%20Providers/openai.md) (OpenAI compatible server)

Once you have it running, you will need to configure it in the GUI or manually add it to your `config.json`.

## Cloud

You can deploy a model in your [AWS](https://github.com/continuedev/deploy-os-code-llm#aws), [GCP](https://github.com/continuedev/deploy-os-code-llm#gcp), [Azure](https://github.com/continuedev/deploy-os-code-llm#azure), or [other clouds](https://github.com/continuedev/deploy-os-code-llm#others-2) using:
- [HuggingFace TGI](https://github.com/continuedev/deploy-os-code-llm#tgi)
- [vLLM](https://github.com/continuedev/deploy-os-code-llm#vllm)
- [SkyPilot](https://github.com/continuedev/deploy-os-code-llm#skypilot)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints) (OpenAI compatible API)

Once you have it deloyed, you will need to wire up a new LLM class and manually add it to your `config.json`. This requires you to implement the `stream_complete`, `complete`, and `stream_chat` methods. You can see examples in [`server/continuedev/libs/llm`](https://github.com/continuedev/continue/tree/main/server/continuedev/libs/llm). However, if the provider has the exact same API interface as OpenAI, the `OpenAI` class will work for you. You will just need to change the `api_base` parameter.

## SaaS

### Open-source LLMs

You can deploy open-source LLMs on a service using:
- [Together](../reference/Model%20Providers/togetherllm.md)
- [HuggingFace Inference Endpoints](../reference/Model%20Providers/huggingfaceinferenceapi.md)
- [Anyscale Endpoints](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [Replicate](../reference/Model%20Providers/replicatellm.md)

### Commercial LLMs

You can use commercial LLMs via APIs using:
- [OpenAI API](../reference/Model%20Providers/openai.md)
- [Azure OpenAI Service](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [Anthrophic API](../reference/Model%20Providers/anthropicllm.md)
- [Google PaLM API](../reference/Model%20Providers/googlepalmapi.md)
- [OpenAI free trial](../reference/Model%20Providers/openaifreetrial.md)