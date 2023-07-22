# Customization

Continue can be deeply customized by editing the `ContinueConfig` object in `~/.continue/config.py` on your machine. This file is created the first time you run Continue.

## Change the default LLM

Change the `default_model` field to any of "gpt-3.5-turbo", "gpt-3.5-turbo-16k", "gpt-4", "claude-2", or "ggml".

### claude-2 and gpt-X

If you have access, simply set `default_model` to the model you would like to use, then you will be prompted for a personal API key after reloading VS Code. If using an OpenAI model, you can press enter to try with our API key for free.

### Local models with ggml

See our [5 minute quickstart](https://github.com/continuedev/ggml-server-example) to run any model locally with ggml. While these models don't yet perform as well, they are free, entirely private, and run offline.

### Azure OpenAI Service

If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant. After applying for access [here](https://azure.microsoft.com/en-us/products/ai-services/openai-service), you will typically hear back within only a few days. Once you have access, set `default_model` to "gpt-4", and then set the `azure_openai_info` property in the `ContinueConfig` like so:

```python
config = ContinueConfig(
    ...
    azure_openai_info=AzureInfo(
        endpoint="https://my-azure-openai-instance.openai.azure.com/",
        engine="my-azure-openai-deployment",
        api_version="2023-03-15-preview"
    )
)
```

The easiest way to find this information is from the chat playground in the Azure OpenAI portal. Under the "Chat Session" section, click "View Code" to see each of these parameters. Finally, find one of your Azure OpenAI keys and enter it in the VS Code settings under `continue.OPENAI_API_KEY`.

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
    The GitHubIssuesContextProvider is a ContextProvider that allows you to search GitHub Issues in a repo.
    """

    title = "issues"
    repo_name: str
    auth_token: str

    async def provide_context_items(self) -> List[ContextItem]:
        auth = Auth.Token(self.auth_token)
        gh = Github(auth=auth)

        repo = gh.get_repo(self.repo_name)
        issues = repo.get_issues().get_page(0)

        items = [ContextItem(
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
        self.context_items = {
            item.description.id.to_string(): item for item in items}
        return items
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
