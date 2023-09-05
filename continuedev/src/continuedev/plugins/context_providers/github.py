from typing import List

from github import Auth, Github

from ...core.context import (
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    ContextProvider,
)


class GitHubIssuesContextProvider(ContextProvider):
    """
    The GitHubIssuesContextProvider is a ContextProvider
    that allows you to search GitHub issues in a repo.
    """

    title = "issues"
    repo_name: str
    auth_token: str

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        auth = Auth.Token(self.auth_token)
        gh = Github(auth=auth)

        repo = gh.get_repo(self.repo_name)
        issues = repo.get_issues().get_page(0)

        return [
            ContextItem(
                content=issue.body,
                description=ContextItemDescription(
                    name=f"Issue #{issue.number}",
                    description=issue.title,
                    id=ContextItemId(provider_title=self.title, item_id=issue.id),
                ),
            )
            for issue in issues
        ]
