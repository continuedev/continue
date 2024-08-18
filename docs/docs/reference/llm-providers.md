---
id: llm-providers
title: LLM Providers
sidebar_label: 🤖 LLM Providers
toc_max_heading_level: 2
description: Overview of the various LLM providers supported by Continue
keywords: [LLM, language models, AI, machine learning, natural language processing]
---

<!-- 
WARNING: This file is auto-generated. Any manual changes to this file will be overwritten.
-->


## Anthropic

To setup Anthropic, obtain an API key from [here](https://www.anthropic.com/api) and add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Anthropic",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Anthropic.ts)


## Azure OpenAI

If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant.

:::info[Getting access]
You need to apply for access to the Azure OpenAI service. Response times are typically within a few days.

**[Click here to apply for access to the Azure OpenAI service](https://azure.microsoft.com/en-us/products/ai-services/openai-service)**
:::

### Configuration

You can configure Azure OpenAI service through the UI, or you can configure it manually in `config.json`.

```json title="~/.continue/config.json"
"models": [{
    "title": "Azure OpenAI",
    "provider": "openai",
    "model": "<YOUR_MODEL>",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "engine": "<YOUR_ENGINE>",
    "apiVersion": "<YOUR_API_VERSION>",
    "apiType": "openai",
    "apiKey": "<MY_API_KEY>"
}]
```

To find out the information from *Azure AI Studio*, select the model that you would like to connect. Under the *Endpoint* section and capture the Target URI.
For example, Target URI of https://just-an-example.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2023-13-15-preview
Maps to:
* model = gpt-4o
* engine = gpt-4o
* apiVersion = 2023-13-15-preview
* apiBase = just-an-example.openai.azure.com


## AWS Bedrock 

To setup Bedrock, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Bedrock: Claude 3 Sonnet",
      "provider": "bedrock",
      "model": "anthropic.claude-3-sonnet-20240229-v1:0",
      "region": "us-east-1"
    }
  ]
}
```

Authentication will be through temporary or long-term credentials in 
~/.aws/credentials under a profile called "bedrock".

```title="~/.aws/credentials
[bedrock]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds. 
```


## Cloudflare Workers AI

Cloudflare Workers AI can be used for both chat and tab autocompletion in Continue. To setup Cloudflare Workers AI, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "accountId": "YOUR CLOUDFLARE ACCOUNT ID",
      "apiKey": "YOUR CLOUDFLARE API KEY",
      "contextLength": 2400,
      "completionOptions": {
        "maxTokens": 500
      },
      "model": "@cf/meta/llama-3-8b-instruct", // This can be the name of any model supported by Workers AI
      "provider": "cloudflare",
      "title": "Llama 3 8B"
    },
    {
      "accountId": "YOUR CLOUDFLARE ACCOUNT ID",
      "apiKey": "YOUR CLOUDFLARE API KEY",
      "contextLength": 2400,
      "completionOptions": {
        "maxTokens": 500
      },
      "model": "@hf/thebloke/deepseek-coder-6.7b-instruct-awq",
      "provider": "cloudflare",
      "title": "DeepSeek Coder 6.7b Instruct"
    }
    ...
    "tabAutocompleteModel": {
      "accountId": "YOUR CLOUDFLARE ACCOUNT ID",
      "apiKey": "YOUR CLOUDFLARE API KEY",
      "model": "@hf/thebloke/deepseek-coder-6.7b-base-awq",
      "provider": "cloudflare",
      "title": "DeepSeek 7b"
    },
  ]
}
```

Visit the [Cloudflare dashboard](https://dash.cloudflare.com/) to [create an API key](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

Review [available models](https://developers.cloudflare.com/workers-ai/models/) on Workers AI

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Cloudflare.ts)


## Cohere

To setup Cohere, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Cohere",
      "provider": "cohere",
      "model": "command-r-plus",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

Visit the [Cohere dashboard](https://dashboard.cohere.com/api-keys) to create an API key.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Cohere.ts)


## DeepInfra

[DeepInfra](https://deepinfra.com) provides inference for open-source models at very low cost. To get started with DeepInfra, obtain your API key [here](https://deepinfra.com/dash). Then, find the model you want to use [here](https://deepinfra.com/models?type=text-generation) and copy the name of the model. Continue can then be configured to use the `DeepInfra` LLM class, like the example here:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "provider": "deepinfra",
      "title": "DeepInfra",
      "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/DeepInfra.ts)


## DeepSeek

To setup DeepSeek, obtain an API key from [here](https://www.deepseek.com/) and add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Deepseek",
      "provider": "deepseek",
      "model": "deepseek-code", // Or any other DeepSeek model
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```


## Flowise

[Flowise](https://flowiseai.com/) is a low-code/no-code drag & drop tool with the aim to make it easy for people to visualize and build LLM apps. Continue can then be configured to use the `Flowise` LLM class, like the example here:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "provider": "flowise",
      "title": "Flowise",
      "model": "<MODEL>",
      "apiBase": "<API_BASE>"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Flowise.ts)


## Free Trial

The `"free-trial"` provider lets new users try out Continue with GPT-4, Llama3, Claude 3, and other models using a proxy server that securely makes API calls to these services. Continue will just work the first time you install the extension. To prevent abuse, we will ask you to sign in with GitHub, which you can [read more about below](#sign-in).

While the Continue extension is always free to use, we cannot support infinite free LLM usage for all of our users. You will eventually need to either:

1. Select an open-source model to use for free locally, or
2. Add your own API key for OpenAI, Anthropic, or another LLM provider

### Options

#### 🦙 Ollama (free, local)

Ollama is a local service that makes it easy to run language models on your laptop.

1. Download Ollama from [https://ollama.ai](https://ollama.ai)
2. Open `~/.continue/config.json`. You can do this by clicking the gear icon in the bottom right corner of the Continue sidebar
3. Add the following to your `config.json`:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Llama3 8b",
      "provider": "ollama",
      "model": "llama3:8b"
    }
  ]
}
```

#### ⚡️ Groq (extremely fast)

Groq provides lightning fast inference for open-source LLMs like Llama3, up to twice as fast as through other providers.

1. Obtain an API key from [Groq's console](https://console.groq.com)
2. Add the following to your `config.json`:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Llama3 70b",
      "provider": "groq",
      "model": "llama3-70b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

#### ✨ OpenAI (highly capable)

1. Copy your API key from [OpenAI's API keys page](https://platform.openai.com/account/api-keys)
2. Add the following to your `config.json`:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

### Sign in

Continue asks free trial users to sign in so that we can prevent abuse of our API endpoints. If you are not using the free trial, we will never ask you to sign in.

#### How do I stop Continue from asking me to sign in?

Remove all models from the "models" array with `"provider": "free-trial"`, and we will never request sign in.

#### What information is collected?

Continue uses your GitHub username and no other information, for the sole purpose of limiting requests.

#### What happens if I don't sign in?

If you don't sign in, you can still use every feature of Continue, you will just need to provide your own LLM either with an API key or by running a local model.

#### How is telemetry related to sign in?

It is not. We do not link your GitHub username to telemetry data.


## Gemini API

The Google Gemini API is currently in beta. You can [create an API key in Google AI Studio](https://aistudio.google.com) and use `gemini-1.5-pro-latest`. Change `~/.continue/config.json` to include the following entry in the "models" array:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Gemini Pro",
      "provider": "gemini",
      "model": "gemini-1.5-pro-latest",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

Google has also released a more lightweight version of the model that still has a one-million-token context window and multimodal capabilities named Gemini Flash. It can be accessed by adding an entry in the models array similar to the above, but substituting "flash" for "pro" in the `title` and `model` values.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Gemini.ts)


## HuggingFace Inference Endpoints

Hugging Face Inference Endpoints are an easy way to setup instances of open-source language models on any cloud. Sign up for an account and add billing [here](https://huggingface.co/settings/billing), access the Inference Endpoints [here](https://ui.endpoints.huggingface.co), click on “New endpoint”, and fill out the form (e.g. select a model like [WizardCoder-Python-34B-V1.0](https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0)), and then deploy your model by clicking “Create Endpoint”. Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Hugging Face Inference API",
      "provider": "huggingface-inference-api",
      "model": "MODEL_NAME",
      "apiKey": "YOUR_HF_TOKEN",
      "apiBase": "INFERENCE_API_ENDPOINT_URL"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/HuggingFaceInferenceAPI.ts)


## HuggingFaceTGI

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/HuggingFaceTGI.ts)


## IPEX-LLM

:::info
[**IPEX-LLM**](https://github.com/intel-analytics/ipex-llm) is a PyTorch library for running LLM on Intel CPU and GPU (e.g., local PC with iGPU, discrete GPU such as Arc A-Series, Flex and Max) with very low latency.
:::

IPEX-LLM supports accelerated Ollama backend to be hosted on Intel GPU. Refer to [this guide](https://ipex-llm.readthedocs.io/en/latest/doc/LLM/Quickstart/ollama_quickstart.html) from IPEX-LLM official documentation about how to install and run Ollama serve accelerated by IPEX-LLM on Intel GPU. You can then configure Continue to use the IPEX-LLM accelerated `"ollama"` provider as follows:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "IPEX-LLM",
      "provider": "ollama",
      "model": "AUTODETECT"
    }
  ]
}
```

If you would like to reach the Ollama service from another machine, make sure you set or export the environment variable `OLLAMA_HOST=0.0.0.0` before executing the command `ollama serve`. Then, in the Continue configuration, set `'apiBase'` to correspond with the IP address / port of the remote machine. That is, Continue can be configured to be:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "IPEX-LLM",
      "provider": "ollama",
      "model": "AUTODETECT",
      "apiBase": "http://your-ollama-service-ip:11434"
    }
  ]
}
```

:::tip

- For more configuration options regarding completion or authentication, you could refer to [here](#ollama) for Ollama provider.
- If you would like to preload the model before your first conversation with that model in Continue, you could refer to [here](https://ipex-llm.readthedocs.io/en/latest/doc/LLM/Quickstart/continue_quickstart.html#pull-and-prepare-the-model) for more information.

:::


## LlamaCpp

Run the llama.cpp server binary to start the API server. If running on a remote server, be sure to set host to 0.0.0.0:

```shell
.\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\meta\llama\codellama-7b-instruct.Q8_0.gguf
```

After it's up and running, change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Llama CPP",
      "provider": "llama.cpp",
      "model": "MODEL_NAME",
      "apiBase": "http://localhost:8080"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/LlamaCpp.ts)


## Llamafile

A [llamafile](https://github.com/Mozilla-Ocho/llamafile#readme) is a self-contained binary that can run an open-source LLM. You can configure this provider in your config.json as follows:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Llamafile",
      "provider": "llamafile",
      "model": "mistral-7b"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Llamafile.ts)


## LM Studio

[LM Studio](https://lmstudio.ai) is an application for Mac, Windows, and Linux that makes it easy to locally run open-source models and comes with a great UI. To get started with LM Studio, download from the website, use the UI to download a model, and then start the local inference server. Continue can then be configured to use the `LMStudio` LLM class:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "LM Studio",
      "provider": "lmstudio",
      "model": "llama2-7b"
    }
  ]
}
```

#### Setting up a remote instance

To configure a remote instance of LM Studio, add the `"apiBase"` property to your model in config.json:

```json title="~/.continue/config.json"
{
  "title": "LM Studio",
  "model": "codestral",
  "provider": "lmstudio",
  "apiBase": "http://x.x.x.x:1234/v1/"
}
```

This `apiBase` will now be used instead of the default `http://localhost:1234/v1`.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/LMStudio.ts)


## Mistral API

The [Mistral](https://mistral.ai) API provides hosted access to their models, including Mistral-7b, Mixtral, and the very capable mistral-medium. After you obtain your API key [here](https://docs.mistral.ai/), Continue can be configured as shown here:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "provider": "mistral",
      "title": "Codestral",
      "model": "codestral-latest",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Mistral.ts)


## Msty

[Msty](https://msty.app/) is an application for Windows, Mac, and Linux that makes it really easy to run online as well as local open-source models, including Llama-2, DeepSeek Coder, etc. No need to fidget with your terminal, run a command, or anything. Just download the app from the website, click a button, and you are up and running. Continue can then be configured to use the `Msty` LLM class:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Msty",
      "provider": "msty",
      "model": "deepseek-coder:6.7b",
      "completionOptions": {}
    }
  ]
}
```

### Completion Options

In addition to the model type, you can also configure some of the parameters that Msty uses to run the model.

- temperature: options.temperature - This is a parameter that controls the randomness of the generated text. Higher values result in more creative but potentially less coherent outputs, while lower values lead to more predictable and focused outputs.
- top_p: options.topP - This sets a threshold (between 0 and 1) to control how diverse the predicted tokens should be. The model generates tokens that are likely according to their probability distribution, but also considers the top-k most probable tokens.
- top_k: options.topK - This parameter limits the number of unique tokens to consider when generating the next token in the sequence. Higher values increase the variety of generated sequences, while lower values lead to more focused outputs.
- num_predict: options.maxTokens - This determines the maximum number of tokens (words or characters) to generate for the given input prompt.
- num_thread: options.numThreads - This is the multi-threading configuration option that controls how many threads the model uses for parallel processing. Higher values may lead to faster generation times but could also increase memory usage and complexity. Set this to one or two lower than the number of threads your CPU can handle to leave some for your GUI when running the model locally.

### Authentication

If you need to send custom headers for authentication, you may use the `requestOptions.headers` property like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Msty",
      "provider": "msty",
      "model": "deepseek-coder:6.7b",
      "requestOptions": {
        "headers": {
          "Authorization": "Bearer xxx"
        }
      }
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Msty.ts)


## Ollama

[Ollama](https://ollama.ai/) is an application for Mac, Windows, and Linux that makes it easy to locally run open-source models, including Llama3. Download the app from the website, and it will walk you through setup in a couple of minutes. You can also read more in their [README](https://github.com/ollama/ollama). Continue can then be configured to use the `"ollama"` provider:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama3:8b"
    }
  ]
}
```

If you'd like to host Ollama on another machine, you can set it up as described in the [Ollama FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-expose-ollama-on-my-network), and then set `"apiBase"` to match the IP address / port of that machine.

### Completion Options

In addition to the model type, you can also configure some of the parameters that Ollama uses to run the model.

- temperature: options.temperature - This is a parameter that controls the randomness of the generated text. Higher values result in more creative but potentially less coherent outputs, while lower values lead to more predictable and focused outputs.
- top_p: options.topP - This sets a threshold (between 0 and 1) to control how diverse the predicted tokens should be. The model generates tokens that are likely according to their probability distribution, but also considers the top-k most probable tokens.
- top_k: options.topK - This parameter limits the number of unique tokens to consider when generating the next token in the sequence. Higher values increase the variety of generated sequences, while lower values lead to more focused outputs.
- num_predict: options.maxTokens - This determines the maximum number of tokens (words or characters) to generate for the given input prompt.
- num_thread: options.numThreads - This is the multi-threading configuration option that controls how many threads the model uses for parallel processing. Higher values may lead to faster generation times but could also increase memory usage and complexity. Set this to one or two lower than the number of threads your CPU can handle to leave some for your GUI when running the model locally.

### Authentication

If you need to send custom headers for authentication, you may use the `requestOptions.headers` property like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama3:8b",
      "requestOptions": {
        "headers": {
          "Authorization": "Bearer xxx"
        }
      }
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Ollama.ts)


## OpenAI

The OpenAI class can be used to access OpenAI models like GPT-4, GPT-4 Turbo, and GPT-3.5 Turbo.

### OpenAI compatible servers / APIs

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

[^1]: Use the [Vllm Model Provider](#vllm) instead

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/OpenAI.ts)


## OpenRouter

OpenRouter is a unified interface for commercial and open-source models, giving you access to the best models at the best prices. You can sign up [here](https://openrouter.ai/signup), create your API key on the [keys page](https://openrouter.ai/keys), and then choose a model from the [list of supported models](https://openrouter.ai/models).

Change `~/.continue/config.json` to look like the following. Since OpenRouter is fully API compatible with OpenAI, it is recommended to stick with `"provider": "openai"`, even if they aren't necessarily the upstream provider.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "OpenRouter LLaMA 70 8B",
      "provider": "openai",
      "model": "meta-llama/llama-3-70b-instruct",
      "apiBase": "https://openrouter.ai/api/v1",
      "apiKey": "..."
    }
  ]
}
```

To utilize features such as provider preferences or model routing configuration, include these parameters inside the `models[].requestsOptions.extraBodyProperties` field of your plugin config.

For example, to prevent extra long prompts from being compressed, you can explicitly turn off the feature like so:

```json title="~/.continue/config.json"
{
  "models": [
    {
      ...
      "requestOptions": {
        "extraBodyProperties": {
          "transforms": []
        }
      }
    }
  ]
}
```

Learn more about available settings [here](https://openrouter.ai/docs).


## ReplicateLLM

Replicate is a great option for newly released language models or models that you've deployed through their platform. Sign up for an account [here](https://replicate.ai/), copy your API key, and then select any model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models). Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Replicate CodeLLama",
      "provider": "replicate",
      "model": "codellama-13b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

If you don't specify the `model` parameter, it will default to `replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781`.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Replicate.ts)


## AWS SageMaker 

SageMaker provider support SageMaker endpoint deployed with [LMI](https://docs.djl.ai/docs/serving/serving/docs/lmi/index.html)

To setup SageMaker, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "deepseek-6.7b-instruct",
      "provider": "sagemaker",
      "model": "lmi-model-deepseek-coder-xxxxxxx",
      "region": "us-west-2"
    },
  ]
}
```

The value in model should be the SageMaker endpoint name you deployed.

Authentication will be through temporary or long-term credentials in 
~/.aws/credentials under a profile called "sagemaker".

```title="~/.aws/credentials
[sagemaker]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds. 
```


## TextGenWebUI

TextGenWebUI is a comprehensive, open-source language model UI and local server. You can set it up with an OpenAI-compatible server plugin, and then configure it in your `config.json` like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Text Generation WebUI",
      "provider": "openai",
      "apiBase": "http://localhost:5000",
      "model": "MODEL_NAME"
    }
  ]
}
```


## TogetherLLM

The Together API is a cloud platform for running large AI models. You can sign up [here](https://api.together.xyz/signup), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Together Models list](https://docs.together.ai/docs/models-inference). Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Together CodeLlama",
      "provider": "together",
      "model": "codellama-13b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Together.ts)


## vLLM

Run the OpenAI-compatible server by vLLM using `vllm serve`. See their [server documentation](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html) and the [engine arguments documentation](https://docs.vllm.ai/en/latest/models/engine_args.html).

```shell
vllm serve NousResearch/Meta-Llama-3-8B-Instruct --max-model-len 1024
```

The continue implementation uses [OpenAI](#openai) under the hood and automatically selects the available model. You only need to set the `apiBase` like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "My vLLM OpenAI-compatible server",
      "apiBase": "http://localhost:8000/v1"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Vllm.ts)


## Watsonx

Watsonx, developed by IBM, offers a variety of pre-trained AI foundation models that can be used for natural language processing (NLP), computer vision, and speech recognition tasks.

### Setup

To access the Watsonx models, create an instance in the [IBM cloud](https://cloud.ibm.com) which supports watsonx studio. Then to create a project refer [this](https://www.ibm.com/docs/en/watsonx/saas?topic=projects-creating-project).

You can set it up in two different ways :

1. **Using API** : Create Your IBM cloud API key by referring [this](https://www.ibm.com/docs/en/mas-cd/continuous-delivery?topic=cli-creating-your-cloud-api-key).
2. **Using Credentials** : Use your Username and Password to authenticate