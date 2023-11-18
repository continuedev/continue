from typing import List

from pydantic import Field

from ...core.context import ContextProvider
from ...core.main import ChatMessage, ContextItem, ContextItemDescription, ContextItemId


class TerminalContextProvider(ContextProvider):
    """Type '@terminal' to reference the contents of your IDE's terminal."""

    title = "terminal"
    display_title = "Terminal"
    description = "Reference the contents of the terminal"
    dynamic = True

    get_last_n_commands: int = Field(
        3, description="The number of previous commands to reference"
    )

    def _terminal_context_item(self, content: str = ""):
        return ContextItem(
            content=content,
            description=ContextItemDescription(
                name="Terminal",
                description="Reference the contents of the VS Code terminal",
                id=ContextItemId(provider_title=self.title, item_id=self.title),
            ),
        )

    async def get_chat_message(self, item: ContextItem) -> ChatMessage:
        msg = await super().get_chat_message(item)
        msg.summary = msg.content[-1000:]
        return msg

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        return [self._terminal_context_item()]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        terminal_contents = await self.ide.getTerminalContents(self.get_last_n_commands)
        terminal_contents = terminal_contents[-5000:]

        return self._terminal_context_item(terminal_contents)
