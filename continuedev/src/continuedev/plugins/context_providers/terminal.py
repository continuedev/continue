from typing import List

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId


class TerminalContextProvider(ContextProvider):
    title = "terminal"

    workspace_dir: str = None

    def _terminal_context_item(self, content: str = ""):
        return ContextItem(
            content=content,
            description=ContextItemDescription(
                name="Terminal",
                description="Reference the contents of the VS Code terminal",
                id=ContextItemId(provider_title=self.title, item_id=self.title),
            ),
        )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.workspace_dir = workspace_dir
        return [self._terminal_context_item()]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.item_id == self.title:
            raise Exception("Invalid item id")

        terminal_contents = await self.sdk.ide.getTerminalContents()

        return self._terminal_context_item(terminal_contents)
