import subprocess
from typing import List

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId


class DiffContextProvider(ContextProvider):
    title = "diff"
    display_title = "Diff"
    description = "Output of 'git diff' in current repo"
    dynamic = True

    DIFF_CONTEXT_ITEM_ID = "diff"

    workspace_dir: str = None

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="Diff",
                description="Reference the output of 'git diff' for the current workspace",
                id=ContextItemId(
                    provider_title=self.title, item_id=self.DIFF_CONTEXT_ITEM_ID
                ),
            ),
        )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.workspace_dir = workspace_dir
        return [self.BASE_CONTEXT_ITEM]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        diff = subprocess.check_output(["git", "diff"], cwd=self.workspace_dir).decode(
            "utf-8"
        )

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = diff
        return ctx_item
