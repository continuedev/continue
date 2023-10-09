import subprocess
from typing import List

from pydantic import Field

from ...core.context import ContextProvider
from ...core.main import (
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    ContinueCustomException,
)


class DiffContextProvider(ContextProvider):
    """
    Type '@diff' to reference all of the changes you've made to your current branch. This is useful if you want to summarize what you've done or ask for a general review of your work before committing.
    """

    title = "diff"
    display_title = "Diff"
    description = "Output of 'git diff' in current repo"
    dynamic = True

    _DIFF_CONTEXT_ITEM_ID = "diff"

    workspace_dir: str = Field(
        None, description="The workspace directory in which to run `git diff`"
    )

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="Diff",
                description="Reference the output of 'git diff' for the current workspace",
                id=ContextItemId(
                    provider_title=self.title, item_id=self._DIFF_CONTEXT_ITEM_ID
                ),
            ),
        )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.workspace_dir = workspace_dir
        return [self.BASE_CONTEXT_ITEM]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        result = subprocess.run(
            ["git", "diff"], cwd=self.workspace_dir, capture_output=True, text=True
        )
        diff = result.stdout
        error = result.stderr
        if error.strip() != "":
            if error.startswith("warning: Not a git repository"):
                raise ContinueCustomException(
                    title="Not a git repository",
                    message="The @diff context provider only works in git repositories.",
                )
            raise ContinueCustomException(
                title="Error running git diff",
                message=f"Error running git diff:\n\n{error}",
            )

        if diff.strip() == "":
            diff = "No changes"

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = diff
        return ctx_item
