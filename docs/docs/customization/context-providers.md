# Context Providers

Context Providers allow you to type '@' and see a dropdown of content that can all be fed to the LLM as context. Every context provider is a plugin, which means if you want to reference some source of information that you don't see here, you can request (or build!) a new context provider.

As an example, say you are working on solving a new GitHub Issue. You type '@issue' and select the one you are working on. Continue can now see the issue title and contents. You also know that the issue is related to the files 'readme.md' and 'helloNested.py', so you type '@readme' and '@hello' to find and select them. Now these 3 "Context Items" are displayed above the input.

![Context Items](/img/context-provider-example.png)

When you enter your next input, Continue will see the full contents of each of these items, and can use them to better answer your questions throughout the conversation.

## Built-in Context Providers

To use any of the built-in context providers, open `~/.continue/config.py` (can do this with the '/config' slash command). For each context provider, you will

1. Import the context provider at the top of the file
2. Add it to the `context_providers` list in the `ContinueConfig` object

Setup instructions are below for each (showing the import and config object). You can also see examples by opening `~/.continue/config.py`.

### GitHub

Type '@issue' to reference the title and contents of a GitHub issue.

```python
from continuedev.plugins.context_providers.github import GitHubIssuesContextProvider
```

```python
GitHubIssuesContextProvider(
    repo_name="continuedev/continue",  # change to whichever repo you want to use
    auth_token="<my_github_auth_token>",
)
```

### Codebase Search

Type '@search' to reference the results of codebase search, just like the results you would get from VS Code search.

```python
from continuedev.plugins.context_providers.search import SearchContextProvider
```

```python
SearchContextProvider() # No arguments necessary
```

### URLs

Type '@url' to reference the contents of a URL. You can either reference preset URLs, or reference one dynamically by typing '@url https://example.com'. The text contents of the page will be fetched and used as context.

```python
from continuedev.plugins.context_providers.url import URLContextProvider
```

```python
URLContextProvider(preset_urls=["https://continue.dev/docs/customization"])
```

### Git Diff

Type '@diff' to reference all of the changes you've made to your current branch. This is useful if you want to summarize what you've done or ask for a general review of your work before committing.

```python
from continuedev.plugins.context_providers.diff import DiffContextProvider
```

```python
DiffContextProvider()
```

### File Tree

Type '@tree' to reference the contents of your current workspace. The LLM will be able to see the nested directory structure of your project.

```python
from continuedev.plugins.context_providers.filetree import FileTreeContextProvider
```

```python
FileTreeContextProvider()
```

### Google

Type '@google' to reference the results of a Google search. For example, type "@google python tutorial" if you want to search and discuss ways of learning Python.

```python
from continuedev.plugins.context_providers.google import GoogleContextProvider
```

```python
GoogleContextProvider(
    serper_api_key="<your serper.dev api key>"
)
```

Note: You can get an API key for free at [serper.dev](https://serper.dev).

### Terminal

Type '@terminal' to reference the contents of your IDE's terminal.

```python
from continuedev.plugins.context_providers.terminal import TerminalContextProvider
```

```python
TerminalContextProvider()
```

### Requesting Context Providers

Not seeing what you want? Create an issue [here](https://github.com/continuedev/continue/issues/new?assignees=TyDunn&labels=enhancement&projects=&template=feature-request-%F0%9F%92%AA.md&title=) to request a new ContextProvider.

## Building Your Own Context Provider

### Introductory Example

As an example, here is the `GitHubIssuesContextProvider`, which lets you search all open GitHub Issues in a repo:

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

This example is a situation where you request all of the data (issues in this case) beforehand, and store them in the ContextProvider.

### Dynamic Context Providers

There are other scenarios where you might want to just get information on demand, for example by typing '@url https://continue.dev/docs/context-providers' and having the ContextProvider fetch the contents of that URL dynamically. For this case, you can implement the `DynamicContextProvider` class like this:

```python
from continuedev.plugins.context_providers.dynamic import DynamicContextProvider

class ExampleDynamicProvider(DynamicProvider):
    title = "example"
    name = "Example"
    description = "Example description"

    async def get_content(self, query: str) -> str:
        return f"Example content for '{query}'"

    async def setup(self):
        print("Example setup")
```

The `setup` method optionally allows you to do any setup when Continue is first loaded. The `get_content` method takes the query (which would be 'https://continue.dev/docs/context-providers' in the example above) and returns the content that will be used as context.
