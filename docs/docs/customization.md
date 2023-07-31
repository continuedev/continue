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
2. Use the cmd+, (Mac) / ctrl+, (Windows) to open your VS Code settings
3. Type "Continue" in the search bar
4. Click Edit in settings.json under Continue: OpenAI_API_KEY" section
5. Paste your API key as the value for "continue.OPENAI_API_KEY" in settings.json

The `MaybeProxyOpenAI` class will automatically switch to using your API key instead of ours. If you'd like to explicitly use one or the other, you can use the `ProxyServer` or `OpenAI` classes instead.

These classes support any models available through the OpenAI API, assuming your API key has access, including "gpt-4", "gpt-3.5-turbo", "gpt-3.5-turbo-16k", and "gpt-4-32k".

### claude-2

Import the `Anthropic` LLM class and set it as the default model:

```python
from continuedev.libs.llm.anthropic import Anthropic

config = ContinueConfig(
    ...
    models=Models(
        default=Anthropic(model="claude-2")
    )
)
```

Continue will automatically prompt you for your Anthropic API key, which must have access to Claude 2. You can request early access [here](https://www.anthropic.com/earlyaccess).

### Local models with ggml

See our [5 minute quickstart](https://github.com/continuedev/ggml-server-example) to run any model locally with ggml. While these models don't yet perform as well, they are free, entirely private, and run offline.

Once the model is running on localhost:8000, import the `GGML` LLM class from `continuedev.libs.llm.ggml` and set `default=GGML(max_context_length=2048)`.

### Self-hosting an open-source model

If you want to self-host on Colab, RunPod, Replicate, HuggingFace, Haven, or another hosting provider you will need to wire up a new LLM class. It only needs to implement 3 primary methods: `stream_complete`, `complete`, and `stream_chat`, and you can see examples in `continuedev/src/continuedev/libs/llm`.

If by chance the provider has the exact same API interface as OpenAI, the `GGML` class will work for you out of the box, after changing the endpoint at the top of the file.

### Azure OpenAI Service

If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant. After applying for access [here](https://azure.microsoft.com/en-us/products/ai-services/openai-service), you will typically hear back within only a few days. Once you have access, instantiate the model like so:

```python
from continuedev.libs.llm.openai import OpenAI, OpenAIServerInfo

config = ContinueConfig(
    ...
    models=Models(
        default=OpenAI(model="gpt-3.5-turbo", server_info=OpenAIServerInfo(
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

## Custom Commands

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
