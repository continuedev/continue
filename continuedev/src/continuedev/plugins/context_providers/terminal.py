from typing import Any, Coroutine, List

from ...core.context import ContextProvider
from ...core.main import ChatMessage, ContextItem, ContextItemDescription, ContextItemId


class TerminalContextProvider(ContextProvider):
    title = "terminal"
    display_title = "Terminal"
    description = "Reference the contents of the terminal"
    dynamic = True

    workspace_dir: str = None
    get_last_n_commands: int = 3

    def _terminal_context_item(self, content: str = ""):
        return ContextItem(
            content=content,
            description=ContextItemDescription(
                name="Terminal",
                description="Reference the contents of the VS Code terminal",
                id=ContextItemId(provider_title=self.title, item_id=self.title),
            ),
        )

    async def get_chat_messages(self) -> Coroutine[Any, Any, List[ChatMessage]]:
        msgs = await super().get_chat_messages()
        for msg in msgs:
            msg.summary = msg.content[-1000:]
        return msgs

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.workspace_dir = workspace_dir
        return [self._terminal_context_item()]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        terminal_contents = await self.sdk.ide.getTerminalContents(
            self.get_last_n_commands
        )
        terminal_contents = terminal_contents[-5000:]

        return self._terminal_context_item(terminal_contents)
