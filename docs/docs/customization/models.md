# Models

Continue makes it easy to swap out different LLM providers. Once you've added any of these to your `config.py`, you will be able to switch between them with the model selection dropdown.

Commercial Models

- [MaybeProxyOpenAI](#adding-an-openai-api-key) (default) - Use gpt-4 or gpt-3.5-turbo free with our API key, or with your API key. gpt-4 is probably the most capable model of all options.
- [OpenAI](#azure-openai-service) - Use any OpenAI model with your own key. Can also change the base URL if you have a server that uses the OpenAI API format, including using the Azure OpenAI service, LocalAI, etc.
- [AnthropicLLM](#claude-2) - Use claude-2 with your Anthropic API key. Claude 2 is also highly capable, and has a 100,000 token context window.

Local Models

- [Ollama](#run-llama-2-locally-with-ollama) - If you have a Mac, Ollama is the simplest way to run open-source models like Code Llama.
- [OpenAI](#local-models-with-openai-compatible-server) - If you have access to an OpenAI-compatible server (e.g. llama-cpp-python, LocalAI, FastChat, TextGenWebUI, etc.), you can use the `OpenAI` class and just change the base URL.
- [GGML](#local-models-with-ggml) - An alternative way to connect to OpenAI-compatible servers. Will use `aiohttp` directly instead of the `openai` Python package.
- [LlamaCpp](#llamacpp) - Build llama.cpp from source and use its built-in API server.

Open-Source Models (not local)

- [TogetherLLM](#together) - Use any model from the [Together Models list](https://docs.together.ai/docs/models-inference) with your Together API key.
- [ReplicateLLM](#replicate) - Use any open-source model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models) with your Replicate API key.
- [HuggingFaceInferenceAPI](#huggingface) - Use any open-source model from the [Hugging Face Inference API](https://huggingface.co/inference-api) with your Hugging Face token.

## Change the default LLM

In `config.py`, you'll find the `models` property:

```python
from continuedev.src.continuedev.core.models import Models

config = ContinueConfig(
    ...
    models=Models(
        default=MaybeProxyOpenAI(model="gpt-4"),
        medium=MaybeProxyOpenAI(model="gpt-3.5-turbo")
    )
)
```

The `default` and `medium` properties are different _model roles_. This allows different models to be used for different tasks. The available roles are `default`, `small`, `medium`, `large`, `edit`, and `chat`. `edit` is used when you use the '/edit' slash command, `chat` is used for all chat responses, and `medium` is used for summarizing. If not set, all roles will fall back to `default`. The values of these fields must be of the [`LLM`](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/libs/llm/__init__.py) class, which implements methods for retrieving and streaming completions from an LLM.

Below, we describe the `LLM` classes available in the Continue core library, and how they can be used.

## Adding an OpenAI API key

## claude-2

## Run Llama-2 locally with Ollama

## Local models with OpenAI-compatible server

## Local models with ggml

## Llama.cpp

## Together

## Replicate

## Hugging Face

## Self-hosting an open-source model

If you want to self-host on Colab, RunPod, HuggingFace, Haven, or another hosting provider you will need to wire up a new LLM class. It only needs to implement 3 primary methods: `stream_complete`, `complete`, and `stream_chat`, and you can see examples in `continuedev/src/continuedev/libs/llm`.

If by chance the provider has the exact same API interface as OpenAI, the `GGML` class will work for you out of the box, after changing the endpoint at the top of the file.

## Azure OpenAI Service

If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant. After applying for access [here](https://azure.microsoft.com/en-us/products/ai-services/openai-service), you will typically hear back within only a few days. Once you have access, instantiate the model like so:

```python
from continuedev.src.continuedev.libs.llm.openai import OpenAI

config = ContinueConfig(
    ...
    models=Models(
        default=OpenAI(
            api_key="my-api-key",
            model="gpt-3.5-turbo",
            api_base="https://my-azure-openai-instance.openai.azure.com/",
            engine="my-azure-openai-deployment",
            api_version="2023-03-15-preview",
            api_type="azure"
        )
    )
)
```

The easiest way to find this information is from the chat playground in the Azure OpenAI portal. Under the "Chat Session" section, click "View Code" to see each of these parameters. Finally, find one of your Azure OpenAI keys and enter it in the VS Code settings under `continue.OPENAI_API_KEY`.

Note that you can also use these parameters for uses other than Azure, such as self-hosting a model.
