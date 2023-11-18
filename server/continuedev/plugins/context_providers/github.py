from typing import List

from github import Auth, Github
from pydantic import Field

from ...core.context import (
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    ContextProvider,
)


class GitHubIssuesContextProvider(ContextProvider):
    """
    The GitHubIssuesContextProvider is a ContextProvider that allows you to search GitHub issues in a repo. Type '@issue' to reference the title and contents of an issue.
    """

    title = "issues"
    repo_name: str = Field(
        ..., description="The name of the GitHub repo from which to pull issues"
    )
    auth_token: str = Field(
        ...,
        description="The GitHub auth token to use to authenticate with the GitHub API",
    )

    display_title = "GitHub Issues"
    description = "Reference GitHub issues"
    dynamic = False

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
                    id=ContextItemId(provider_title=self.title, item_id=str(issue.id)),
                ),
            )
            for issue in issues
        ]
