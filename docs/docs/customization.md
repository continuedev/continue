# Customization

Continue can be deeply customized by editing the `ContinueConfig` object in `~/.continue/config.py` on your machine. This file is created the first time you run Continue.

## Change the default LLM

In `config.py`, you'll find the `models` property:

```python
config = ContinueConfig(
    ...
    models=Models(
        default=MaybeProxyOpenAI(model="gpt-4"),
        medium=MaybeProxyOpenAI(model="gpt-3.5-turbo")
    )
)
```

The `default` model is the one used for most operations, including responding to your messages and editing code. The `medium` model is used for summarization tasks that require less quality. There are also `small` and `large` roles that can be filled, but all will fall back to `default` if not set. The values of these fields must be of the [`LLM`](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/libs/llm/__init__.py) class, which implements methods for retrieving and streaming completions from an LLM.

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

### Replicate (beta)

Replicate is a great option for newly released language models or models that you've deployed through their platform. Sign up for an account [here](https://replicate.ai/), copy your API key, and then select any model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models). Change the config file to look like this:

```python
from continuedev.src.continuedev.libs.llm.replicate import ReplicateLLM

config = ContinueConfig(
    ...
    models=Models(
        default=ReplicateLLM(
            model="stablecode-completion-alpha-3b-4k",
            api_key="my-replicate-api-key")
    )
)
```

If you don't specify the `model` parameter, it will default to `stablecode-completion-alpha-3b-4k`.

### Self-hosting an open-source model

If you want to self-host on Colab, RunPod, HuggingFace, Haven, or another hosting provider you will need to wire up a new LLM class. It only needs to implement 3 primary methods: `stream_complete`, `complete`, and `stream_chat`, and you can see examples in `continuedev/src/continuedev/libs/llm`.

If by chance the provider has the exact same API interface as OpenAI, the `GGML` class will work for you out of the box, after changing the endpoint at the top of the file.

### Azure OpenAI Service

If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant. After applying for access [here](https://azure.microsoft.com/en-us/products/ai-services/openai-service), you will typically hear back within only a few days. Once you have access, instantiate the model like so:

```python
from continuedev.src.continuedev.libs.llm.openai import OpenAI, OpenAIServerInfo

config = ContinueConfig(
    ...
    models=Models(
        default=OpenAI(api_key="my-api-key", model="gpt-3.5-turbo", server_info=OpenAIServerInfo(
            api_base="https://my-azure-openai-instance.openai.azure.com/"
            engine="my-azure-openai-deployment",
            api_version="2023-03-15-preview",
            api_type="azure"
        ))
    )
)
```

The easiest way to find this information is from the chat playground in the Azure OpenAI portal. Under the "Chat Session" section, click "View Code" to see each of these parameters. Finally, find one of your Azure OpenAI keys and enter it in the VS Code settings under `continue.OPENAI_API_KEY`.

Note that you can also use `OpenAIServerInfo` for uses other than Azure, such as self-hosting a model.

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

## Custom Context Providers

When you type '@' in the Continue text box, it will display a dropdown of items that can be selected to include in your message as context. For example, you might want to reference a GitHub Issue, file, or Slack thread. All of these options are provided by a `ContextProvider` class, and we make it easy to write your own. As an example, here is the `GitHubIssuesContextProvider`, which lets you search all open GitHub Issues in a repo:

```python
class GitHubIssuesContextProvider(ContextProvider):
    """
    The GitHubIssuesContextProvider is a ContextProvider that allows you to search GitHub issues in a repo.
    """

    title = "issues"
    repo_name: str
    auth_token: str

    async def provide_context_items(self) -> List[ContextItem]:
        auth = Auth.Token(self.auth_token)
        gh = Github(auth=auth)

        repo = gh.get_repo(self.repo_name)
        issues = repo.get_issues().get_page(0)

        return [ContextItem(
            content=issue.body,
            description=ContextItemDescription(
                name=f"Issue #{issue.number}",
                description=issue.title,
                id=ContextItemId(
                    provider_title=self.title,
                    item_id=issue.id
                )
            )
        ) for issue in issues]
```

It can then be set in the `ContinueConfig` like so:

```python
config = ContinueConfig(
    ...
    context_providers=[
        GitHubIssuesContextProvider(
            repo_name="my-github-username-or-org/my-github-repo",
            auth_token="my-github-auth-token"
        )
    ]
)
```

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
