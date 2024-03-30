---
title: 选择一个提供者
description: 切换不同的 LLM 提供者
keywords: [openai, anthropic, PaLM, ollama, ggml]
---

# 选择一个模型提供者

Continue 可以简单地切换不同的 LLM 提供者。你可以点击模型下拉框旁边的 "+" 按钮在 GUI 中配置，或者手动添加它们到你的 `config.json` 中。一旦你完成这个，你可以在模型选择下拉框中切换它们。

**除了选择一个模型提供者，你需要解决 [使用哪个 LLM](./select-model.md)。**

## 本地

你可以在你的本地电脑上运行一个模型，使用：

- [Ollama](../reference/Model%20Providers/ollama.md)
- [LM Studio](../reference/Model%20Providers/lmstudio.md)
- [Llama.cpp](../reference/Model%20Providers/llamacpp.md)
- [KoboldCpp](../reference/Model%20Providers/openai.md) (OpenAI 兼容服务器)
- [llamafile](../reference/Model%20Providers/llamafile) ((OpenAI 兼容服务器)
- [LocalAI](../reference/Model%20Providers/openai.md) (OpenAI 兼容服务器)
- [Text generation web UI](../reference/Model%20Providers/openai.md) (OpenAI 兼容服务器)
- [FastChat](../reference/Model%20Providers/openai.md) (OpenAI 兼容服务器)
- [llama-cpp-python](../reference/Model%20Providers/openai.md) (OpenAI 兼容服务器)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples) (OpenAI 兼容服务器)

一旦你运行它，你需要在 GUI 中配置它，或者手动添加它到你的 `config.json` 。

## 云上

你可以部署一个模型在你的 [AWS](https://github.com/continuedev/deploy-os-code-llm#aws), [GCP](https://github.com/continuedev/deploy-os-code-llm#gcp), [Azure](https://github.com/continuedev/deploy-os-code-llm#azure), 或者 [其他云](https://github.com/continuedev/deploy-os-code-llm#others-2) 上，使用:

- [HuggingFace TGI](https://github.com/continuedev/deploy-os-code-llm#tgi)
- [vLLM](https://github.com/continuedev/deploy-os-code-llm#vllm)
- [SkyPilot](https://github.com/continuedev/deploy-os-code-llm#skypilot)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints) (OpenAI 兼容 API)

如果你使用的 API 是 OpenAI 兼容的，你可以使用 `config.json` 中的 "openai" 提供者，修改 `apiBase` 指向那个服务器。否则，你需要在 `config.ts` 中编写一个新的 LLM 类。学习如何做这个，[这里](configuration.md#defining-a-custom-llm-provider)

## SaaS

### 开源 LLM

你可以在 SaaS 服务上部署开源 LLM ，使用：

- [Together](../reference/Model%20Providers/togetherllm.md)
- [HuggingFace Inference Endpoints](../reference/Model%20Providers/huggingfaceinferenceapi.md)
- [Anyscale Endpoints](../reference/Model%20Providers/openai.md) (OpenAI 兼容 API)
- [Replicate](../reference/Model%20Providers/replicatellm.md)
- [Deepinfra](../reference/Model%20Providers/deepinfra.md)

### 商业 LLM

你可以 API 使用商业 LLM ，使用：

- [OpenAI API](../reference/Model%20Providers/openai.md)
- [Azure OpenAI Service](../reference/Model%20Providers/openai.md) (OpenAI 兼容 API)
- [Anthrophic API](../reference/Model%20Providers/anthropicllm.md)
- [Google PaLM API](../reference/Model%20Providers/googlepalmapi.md)
- [OpenAI free trial](../reference/Model%20Providers/freetrial.md)
- [Mistral API](../reference/Model%20Providers/mistral.md)
