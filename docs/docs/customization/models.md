# Models

Continue makes it easy to swap out different LLM providers. Once you've added any of these to your `config.py`, you will be able to switch between them with the model selection dropdown.

Commercial Models

- [OpenAIFreeTrial](../reference/Models/openaifreetrial.md) (default) - Use gpt-4 or gpt-3.5-turbo free with our API key, or with your API key. gpt-4 is probably the most capable model of all options.
- [OpenAI](../reference/Models/openai.md) - Use any OpenAI model with your own key. Can also change the base URL if you have a server that uses the OpenAI API format, including using the Azure OpenAI service, LocalAI, etc.
- [AnthropicLLM](../reference/Models/anthropicllm.md) - Use claude-2 with your Anthropic API key. Claude 2 is also highly capable, and has a 100,000 token context window.

Local Models

- [Ollama](../reference/Models/ollama.md) - If you have a Mac, Ollama is the simplest way to run open-source models like Code Llama.
- [OpenAI](../reference/Models/openai.md) - If you have access to an OpenAI-compatible server (e.g. llama-cpp-python, LocalAI, FastChat, TextGenWebUI, etc.), you can use the `OpenAI` class and just change the base URL.
- [GGML](../reference/Models/ggml.md) - An alternative way to connect to OpenAI-compatible servers. Will use `aiohttp` directly instead of the `openai` Python package.
- [LlamaCpp](../reference/Models/llamacpp.md) - Build llama.cpp from source and use its built-in API server.

Open-Source Models (not local)

- [TogetherLLM](../reference/Models/togetherllm.md) - Use any model from the [Together Models list](https://docs.together.ai/docs/models-inference) with your Together API key.
- [ReplicateLLM](../reference/Models/replicatellm.md) - Use any open-source model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models) with your Replicate API key.
- [HuggingFaceInferenceAPI](../reference/Models/huggingfaceinferenceapi.md) - Use any open-source model from the [Hugging Face Inference API](https://huggingface.co/inference-api) with your Hugging Face token.

## Change the default LLM

In `config.py`, you'll find the `models` property:

```python
from continuedev.src.continuedev.core.models import Models

config = ContinueConfig(
    ...
    models=Models(
        default=OpenAIFreeTrial(model="gpt-4"),
        summarize=OpenAIFreeTrial(model="gpt-3.5-turbo")
    )
)
```

The `default` and `summarize` properties are different _model roles_. This allows different models to be used for different tasks. The available roles are `default`, `summarize`, `edit`, and `chat`. `edit` is used when you use the '/edit' slash command, `chat` is used for all chat responses, and `summarize` is used for summarizing. If not set, all roles will fall back to `default`. The values of these fields must be of the [`LLM`](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/libs/llm/__init__.py) class, which implements methods for retrieving and streaming completions from an LLM.

Below, we describe the `LLM` classes available in the Continue core library, and how they can be used.

## Self-hosting an open-source model

If you want to self-host on Colab, RunPod, HuggingFace, Haven, or another hosting provider, you will need to wire up a new LLM class. It only needs to implement 3 primary methods: `stream_complete`, `complete`, and `stream_chat`, and you can see examples in `continuedev/src/continuedev/libs/llm`.

If by chance the provider has the exact same API interface as OpenAI, the `OpenAI` class will work for you out of the box, after changing only the `api_base` parameter.

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

## Customizing the Chat Template

Most open-source models expect a specific chat format, for example llama2 and codellama expect the input to look like "[INST] How do I write bubble sort in Rust? [/INST]". Other than for the OpenAI classes, the llama2 chat format is the default, but this is not correct for all models. If you are receiving nonsense responses, you can use the `template_messages` property to set the chat template to match the model you are using. This property is a function that takes a list of `ChatMessage`s and returns a string.

Here is an example of `template_messages` for the Alpaca/Vicuna format:

```python
def template_alpaca_messages(msgs: List[Dict[str, str]]) -> str:
    prompt = ""

    if msgs[0]["role"] == "system":
        prompt += f"{msgs[0]['content']}\n"
        msgs.pop(0)

    prompt += "### Instruction:\n"
    for msg in msgs:
        prompt += f"{msg['content']}\n"

    prompt += "### Response:\n"

    return prompt
```

It can then be used like this:

```python
from continuedev.src.continuedev.libs.llm.chat import template_alpaca_messages
from continuedev.src.continuedev.libs.llm.ollama import Ollama
...
config=ContinueConfig(
    ...
    models=Models(
        default=Ollama(
            model="vicuna",
            template_messages=template_alpaca_messages
        )
    )
)
```

This exact function and a few other default implementations are available in [`continuedev.src.continuedev.libs.llm.prompts.chat`](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/libs/llm/prompts/chat.py).

## Customizing the /edit Prompt

You also have access to customize the prompt used in the '/edit' slash command. We already have a well-engineered prompt for GPT-4 and a sensible default for less powerful open-source models, but you might wish to play with the prompt and try to find a more reliable alternative if you are for example getting English as well as code in your output.

To customize the prompt, use the `prompt_templates` property of any `LLM`, which is a dictionary, and set the "edit" key to a template string with Mustache syntax. The 'file_prefix', 'file_suffix', 'code_to_edit', and 'user_input' variables are available in the template. Here is an example (the default for non-GPT-4 models):

````python
"""
[INST] Consider the following code:
```
{{code_to_edit}}

```
Edit the code to perfectly satisfy the following user request:
{{user_input}}
Output nothing except for the code. No code block, no English explanation, no start/end tags.
[/INST]
"""
````

It can then be used like this:

```python
from continuedev.src.continuedev.libs.llm.ollama import Ollama
...
config=ContinueConfig(
    ...
    models=Models(
        default=Ollama(
            model="vicuna",
            prompt_templates={
                "edit": "<INSERT_TEMPLATE_HERE>"
            }
        )
    )
)
```

A few pre-made templates are available in [`continuedev.src.continuedev.libs.llm.prompts.edit`](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/libs/llm/prompts/edit.py).
