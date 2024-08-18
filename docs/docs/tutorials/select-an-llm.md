---
title: How to Select an LLM
description: How to run Continue without Internet
keywords: [no internet, air-gapped, local model]
---

## Model Providers

Configure and integrate various LLM (Large Language Model) providers for chat, autocomplete, and embedding models, whether self-hosted, remote, or via SaaS.

To select the ones you want to use, add them to your `config.json`.

### Self-hosted

#### Local

You can run a model on your local computer using:

- [Ollama](../reference/Model%20Providers/ollama.md)
- [LM Studio](../reference/Model%20Providers/lmstudio.md)
- [Llama.cpp](../reference/Model%20Providers/llamacpp.md)
- [KoboldCpp](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [llamafile](../reference/Model%20Providers/llamafile) (OpenAI compatible server)
- [LocalAI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [Text generation web UI](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [FastChat](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [llama-cpp-python](../reference/Model%20Providers/openai.md) (OpenAI compatible server)
- [TensorRT-LLM](https://github.com/NVIDIA/trt-llm-as-openai-windows?tab=readme-ov-file#examples) (OpenAI compatible server)
- [IPEX-LLM](../reference/Model%20Providers/ipex_llm.md) (Local LLM on Intel GPU)
- [Msty](../reference/Model%20Providers/msty.md)
- [Watsonx](../reference/Model%20Providers/watsonx.md)
- [Nvidia NIMS](../reference/Model%20Providers/openai.md) (OpenAI compatible server)

#### Remote

You can deploy a model in your [AWS](https://github.com/continuedev/deploy-os-code-llm#aws), [GCP](https://github.com/continuedev/deploy-os-code-llm#gcp), [Azure](https://github.com/continuedev/deploy-os-code-llm#azure), or [other clouds](https://github.com/continuedev/deploy-os-code-llm#others-2) using:

- [HuggingFace TGI](https://github.com/continuedev/deploy-os-code-llm#tgi)
- [vLLM](https://github.com/continuedev/deploy-os-code-llm#vllm)
- [SkyPilot](https://github.com/continuedev/deploy-os-code-llm#skypilot)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints) (OpenAI compatible API)

### SaaS

You can access both open-source and commercial LLMs via:

- [OpenRouter](../reference/Model%20Providers/openrouter.md)

#### Open-source models

You can run open-source LLMs with cloud services like:

- [Codestral API](../walkthroughs/set-up-codestral.md)
- [Together](../reference/Model%20Providers/togetherllm.md)
- [HuggingFace Inference Endpoints](../reference/Model%20Providers/huggingfaceinferenceapi.md)
- [Anyscale Endpoints](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [Replicate](../reference/Model%20Providers/replicatellm.md)
- [Deepinfra](../reference/Model%20Providers/deepinfra.md)
- [Groq](../reference/Model%20Providers/openai.md) (OpenAI compatible API)
- [AWS Bedrock](../reference/Model%20Providers/bedrock.md)
- [Nvidia NIMS](../reference/Model%20Providers/openai.md) (OpenAI compatible server)

#### Commercial models

You can use commercial LLMs via APIs using:

- [Anthrophic API](../reference/Model%20Providers/anthropicllm.md)
- [OpenAI API](../reference/Model%20Providers/openai.md)
- [Azure OpenAI Service](../reference/Model%20Providers/openai.md)
- [Google Gemini API](../reference/Model%20Providers/geminiapi.md)
- [Mistral API](../reference/Model%20Providers/mistral.md)
- [Voyage AI API](../features/codebase-embeddings.md#openai)
- [Cohere API](../reference/Model%20Providers/cohere.md)

**In addition to selecting providers, you will need to figure out [what models to use](./select-model.md).**

## Select models

Continue makes it easy to use different models for chat, autocomplete, and embeddings. To select the models you want to use, add them to your `config.json`.

### Chat

You likely want to use a model that is 30B+ parameters for chat.

#### Open-source LLMs

_We currently recommend the following open-source models:_

##### Llama 3 from Meta

- Unlimited GPU: `llama3-70b`
- Limited GPU: `llama3-8B`

##### DeepSeek Coder v2 from DeepSeek

- Unlimited GPU: `deepseek-coder-v2:236b`
- Limited GPU: `deepseek-coder-v2:16b`

_You can also use other open-source chat models by adding them to your `config.json`._

#### Commercial LLMs

##### Claude 3 from Anthropic

- Unlimited budget: `claude-3-5-sonnet-20240620`
- Limited budget: `claude-3-5-sonnet-20240620`

##### GPT-4o from OpenAI

- Unlimited budget: `gpt-4o`
- Limited budget: `gpt-4o-mini`

##### Gemini Pro from Google

- Unlimited budget: `gemini-pro-1.5-latest`
- Limited budget: `gemini-flash-1.5-latest` or `gemini-pro-1.0`

_You can also use other commercial chat models by adding them to your `config.json`._

#### Setting up chat models

In `config.json`, you'll find the `models` property, a list of the models that you have saved to use with Continue:

```json
"models": [
    {
        "title": "GPT-4o",
        "provider": "free-trial",
        "model": "gpt-4o"
    },
    {
        "title": "GPT-4o Mini",
        "provider": "free-trial",
        "model": "gpt-4o-mini"
    }
]
```

Just by specifying the `model` and `provider` properties, we will automatically detect prompt templates and other important information, but if you're looking to do something beyond this basic setup, we'll explain a few other options below.

### Autocomplete

You likely want to use a model that is 1-15B parameters for autocomplete. You can read more about it [here](../features/tab-autocomplete.md#tab-autocomplete-beta)

#### Commercial LLMs

##### Codestral from Mistral

Our current recommendation for autocomplete, if you are able to choose any model, is `codestral-latest` from [Mistral's API](../walkthroughs/set-up-codestral.md).

#### Open-source LLMs

_We currently recommend the following open-source models:_

##### DeepSeek Coder v2 from DeepSeek

- Unlimited GPU: `deepseek-coder-v2:16b`
- Limited GPU: `deepseek-coder:6.7b` or `deepseek-coder:1.3b`

##### StarCoder 2 from Hugging Face

- Unlimited GPU: `starcoder-2-7b`
- Limited GPU: `starcoder-2-3b`

_You can also use other autocomplete models by adding them to your `config.json`._

### Embeddings

We recommend the following embeddings models, which are used for codebase retrieval as described [here](../features/codebase-embeddings.md#embeddings-providers)

#### Open-source models

- `nomic-embed-text`

#### Commercial models

- `voyage-code-2`

_You can also use other embeddings models by adding them to your `config.json`._

**In addition to selecting models, you will need to figure out [what model providers to use](./model-providers.md).**
