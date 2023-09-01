# Using Code Llama with Continue

With Continue, you can use Code Llama as a drop-in replacement for GPT-4, either by running locally with Ollama or GGML or through Replicate.

If you haven't already installed Continue, you can do that [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue). For more general information on customizing Continue, read [our customization docs](../customization.md).

## TogetherAI

1. Create an account [here](https://api.together.xyz/signup)
2. Copy your API key that appears on the welcome screen
3. Click the "play" button on Code Llama Instruct (13B) on the [Together Models list](https://docs.together.ai/docs/models-inference)
4. Update your Continue config file to look like this:

```python
from continuedev.src.continuedev.core.models import Models
from continuedev.src.continuedev.libs.llm.together import TogetherLLM

config = ContinueConfig(
    ...
    models=Models(
        default=TogetherLLM(
            api_key="<API_KEY>",
            model="togethercomputer/CodeLlama-13b-Instruct"
        )
    )
)
```

## Ollama

1. Download Ollama [here](https://ollama.ai/) (it should walk you through the rest of these steps)
2. Open a terminal and run `ollama pull codellama`\*
3. Change your Continue config file to look like this:

```python
from continuedev.src.continuedev.libs.llm.ollama import Ollama

config = ContinueConfig(
    ...
    models=Models(
        default=Ollama(model="codellama")
    )
)
```

5. Reload the VS Code window for changes to take effect

\*Only the 7b model is available right now. The others will be ready later today or tomorrow.

## Replicate

1. Get your Replicate API key [here](https://replicate.ai/)
2. Change your Continue config file to look like this:

```python
from continuedev.src.continuedev.core.models import Models
from continuedev.src.continuedev.libs.llm.replicate import ReplicateLLM

config = ContinueConfig(
    ...
    models=Models(
        default=ReplicateLLM(
            model="replicate/codellama-13b-instruct:da5676342de1a5a335b848383af297f592b816b950a43d251a0a9edd0113604b",
            api_key="<MY_REPLICATE_API_KEY>")
    )
)
```

3. Reload the VS Code window for changes to take effect

## FastChat API
1. Setup the FastChat API (https://github.com/lm-sys/FastChat) to use one of the Codellama models on Hugging Face (e.g: codellama/CodeLlama-7b-Instruct-hf).
2. Start the OpenAI compatible API (ref: https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md).
3. Change your Continue config file to look like this:

```python
config = ContinueConfig(
    ...
    models=Models(default=OpenAI(
        model="CodeLlama-7b-Instruct-hf",
        openai_server_info={'api_base': 'http://localhost:8000/v1'})

```
4. Reload the VS Code window for changes to take effect.
