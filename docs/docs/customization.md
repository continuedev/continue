# Customization

Continue can be deeply customized by editing the `ContinueConfig` object in `~/.continue/config.py` (`%userprofile%\.continue\config.py` for Windows) on your machine. This file is created the first time you run Continue.

## Summary of Models

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

### Adding an OpenAI API key

With the `MaybeProxyOpenAI` `LLM`, new users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key. Continue should just work the first time you install the extension in VS Code.

Once you are using Continue regularly though, you will need to add an OpenAI API key that has access to GPT-4 by following these steps:

1. Copy your API key from https://platform.openai.com/account/api-keys
2. Open `~/.continue/config.py`. You can do this by using the '/config' command in Continue
3. Change the default LLMs to look like this:

```python
API_KEY = "<API_KEY>"
config = ContinueConfig(
    ...
    models=Models(
        default=MaybeProxyOpenAI(model="gpt-4", api_key=API_KEY),
        medium=MaybeProxyOpenAI(model="gpt-3.5-turbo", api_key=API_KEY)
    )
)
```

The `MaybeProxyOpenAI` class will automatically switch to using your API key instead of ours. If you'd like to explicitly use one or the other, you can use the `ProxyServer` or `OpenAI` classes instead.

These classes support any models available through the OpenAI API, assuming your API key has access, including "gpt-4", "gpt-3.5-turbo", "gpt-3.5-turbo-16k", and "gpt-4-32k".

### claude-2

Import the `AnthropicLLM` LLM class and set it as the default model:

```python
from continuedev.src.continuedev.libs.llm.anthropic import AnthropicLLM

config = ContinueConfig(
    ...
    models=Models(
        default=AnthropicLLM(api_key="<API_KEY>", model="claude-2")
    )
)
```

Continue will automatically prompt you for your Anthropic API key, which must have access to Claude 2. You can request early access [here](https://www.anthropic.com/earlyaccess).

### Run Llama-2 locally with Ollama

[Ollama](https://ollama.ai/) is a Mac application that makes it easy to locally run open-source models, including Llama-2. Download the app from the website, and it will walk you through setup in a couple of minutes. You can also read more in their [README](https://github.com/jmorganca/ollama). Continue can then be configured to use the `Ollama` LLM class:

```python
from continuedev.src.continuedev.libs.llm.ollama import Ollama

config = ContinueConfig(
    ...
    models=Models(
        default=Ollama(model="llama2")
    )
)
```

### Local models with OpenAI-compatible server

If you are locally serving a model that uses an OpenAI-compatible server, you can simply change the `api_base` in the `OpenAI` class like this:

```python
from continuedev.src.continuedev.libs.llm.openai import OpenAI

config = ContinueConfig(
    ...
    models=Models(
        default=OpenAI(
            api_key="EMPTY",
            model="<MODEL_NAME>",
            api_base="http://localhost:8000", # change to your server
        )
    )
)
```

Options for serving models locally with an OpenAI-compatible server include:

- [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
- [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
- [LocalAI](https://localai.io/basics/getting_started/)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)

### Local models with ggml

See our [5 minute quickstart](https://github.com/continuedev/ggml-server-example) to run any model locally with ggml. While these models don't yet perform as well, they are free, entirely private, and run offline.

Once the model is running on localhost:8000, change `~/.continue/config.py` to look like this:

```python
from continuedev.src.continuedev.libs.llm.ggml import GGML

config = ContinueConfig(
    ...
    models=Models(
        default=GGML(
            max_context_length=2048,
            server_url="http://localhost:8000")
    )
)
```

### Llama.cpp

Run the llama.cpp server binary to start the API server. If running on a remote server, be sure to set host to 0.0.0.0:

```shell
.\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\meta\llama\codellama-7b-instruct.Q8_0.gguf
```

After it's up and running, change `~/.continue/config.py` to look like this:

```python
from continuedev.src.continuedev.libs.llm.llamacpp import LlamaCpp

config = ContinueConfig(
    ...
    models=Models(
        default=LlamaCpp(
            max_context_length=4096,
            server_url="http://localhost:8080")
    )
)
```

### Together

The Together API is a cloud platform for running large AI models. You can sign up [here](https://api.together.xyz/signup), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Together Models list](https://docs.together.ai/docs/models-inference). Change `~/.continue/config.py` to look like this:

```python
from continuedev.src.continuedev.core.models import Models
from continuedev.src.continuedev.libs.llm.together import TogetherLLM

config = ContinueConfig(
    ...
    models=Models(
        default=TogetherLLM(
            api_key="<API_KEY>",
            model="togethercomputer/llama-2-13b-chat"
        )
    )
)
```

### Replicate

Replicate is a great option for newly released language models or models that you've deployed through their platform. Sign up for an account [here](https://replicate.ai/), copy your API key, and then select any model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models). Change `~/.continue/config.py` to look like this:

```python
from continuedev.src.continuedev.core.models import Models
from continuedev.src.continuedev.libs.llm.replicate import ReplicateLLM

config = ContinueConfig(
    ...
    models=Models(
        default=ReplicateLLM(
            model="replicate/codellama-13b-instruct:da5676342de1a5a335b848383af297f592b816b950a43d251a0a9edd0113604b",
            api_key="my-replicate-api-key")
    )
)
```

If you don't specify the `model` parameter, it will default to `replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781`.

### Self-hosting an open-source model

If you want to self-host on Colab, RunPod, HuggingFace, Haven, or another hosting provider you will need to wire up a new LLM class. It only needs to implement 3 primary methods: `stream_complete`, `complete`, and `stream_chat`, and you can see examples in `continuedev/src/continuedev/libs/llm`.

If by chance the provider has the exact same API interface as OpenAI, the `GGML` class will work for you out of the box, after changing the endpoint at the top of the file.

### Azure OpenAI Service

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

## Customize System Message

You can write your own system message, a set of instructions that will always be top-of-mind for the LLM, by setting the `system_message` property to any string. For example, you might request "Please make all responses as concise as possible and never repeat something you have already explained."

System messages can also reference files. For example, if there is a markdown file (e.g. at `/Users/nate/Documents/docs/reference.md`) you'd like the LLM to know about, you can reference it with [Mustache](http://mustache.github.io/mustache.5.html) templating like this: "Please reference this documentation: {{ Users/nate/Documents/docs/reference.md }}". As of now, you must use an absolute path.

## Custom Commands with Natural Language Prompts

You can add custom slash commands by adding a `CustomCommand` object to the `custom_commands` property. Each `CustomCommand` has

- `name`: the name of the command, which will be invoked with `/name`
- `description`: a short description of the command, which will appear in the dropdown
- `prompt`: a set of instructions to the LLM, which will be shown in the prompt

Custom commands are great when you are frequently reusing a prompt. For example, if you've crafted a great prompt and frequently ask the LLM to check for mistakes in your code, you could add a command like this:

```python
config = ContinueConfig(
    ...
    custom_commands=[
        CustomCommand(
            name="check",
            description="Check for mistakes in my code",
            prompt=dedent("""\
            Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:
            - Syntax errors
            - Logic errors
            - Security vulnerabilities
            - Performance issues
            - Anything else that looks wrong

            Once you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying "I think there is a syntax error on line 5", you should say "Syntax error on line 5". Give your answer as one bullet point per mistake found.""")
        )
    ]
)
```

## Custom Slash Commands

If you want to go a step further than writing custom commands with natural language, you can use a `SlashCommand` to run an arbitrary Python function, with access to the Continue SDK. To do this, create a subclass of `Step` with the `run` method implemented, and this is the code that will run when you call the command. For example, here is a step that generates a commit message:

```python
class CommitMessageStep(Step):
    async def run(self, sdk: ContinueSDK):

        # Get the root directory of the workspace
        dir = sdk.ide.workspace_directory

        # Run git diff in that directory
        diff = subprocess.check_output(
            ["git", "diff"], cwd=dir).decode("utf-8")

        # Ask the LLM to write a commit message,
        # and set it as the description of this step
        self.description = await sdk.models.default.complete(
            f"{diff}\n\nWrite a short, specific (less than 50 chars) commit message about the above changes:")

config=ContinueConfig(
    ...
    slash_commands=[
        ...
        SlashCommand(
            name="commit",
            description="Generate a commit message for the current changes",
            step=CommitMessageStep,
        )
    ]
)
```

## Temperature

Set `temperature` to any value between 0 and 1. Higher values will make the LLM more creative, while lower values will make it more predictable. The default is 0.5.

## Context Providers

When you type '@' in the Continue text box, it will display a dropdown of items that can be selected to include in your message as context. For example, you might want to reference a GitHub Issue, file, or Slack thread. All of these options are provided by a `ContextProvider` class, and we make it easy to write your own or use our builtin options. See the [Context Providers](./context-providers.md) page for more info.

## Custom Policies

Policies can be used to deeply change the behavior of Continue, or to build agents that take longer sequences of actions on their own. The [`DefaultPolicy`](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/plugins/policies/default.py) handles the parsing of slash commands, and otherwise always chooses the `SimpleChatStep`, but you could customize by for example always taking a "review" step after editing code. To do so, create a new `Policy` subclass that implements the `next` method:

```python
class ReviewEditsPolicy(Policy):

    default_step: Step = SimpleChatStep()

    def next(self, config: ContinueConfig, history: History) -> Step:
        # Get the last step
        last_step = history.get_current()

        # If it edited code, then review the changes
        if isinstance(last_step, EditHighlightedCodeStep):
            return ReviewStep()  # Not implemented

        # Otherwise, choose between EditHighlightedCodeStep and SimpleChatStep based on slash command
        if observation is not None and isinstance(last_step.observation, UserInputObservation):
            if user_input.startswith("/edit"):
                return EditHighlightedCodeStep(user_input=user_input[5:])
            else:
                return SimpleChatStep()

            return self.default_step.copy()

        # Don't do anything until the user enters something else
        return None
```

Then, in `~/.continue/config.py`, override the default policy:

```python
config=ContinueConfig(
    ...
    policy_override=ReviewEditsPolicy()
)
```
