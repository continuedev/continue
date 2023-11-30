import os
from typing import List

from ...core.context import ContextProvider
from ...core.main import ChatMessage, ContextItem, ContextItemDescription, ContextItemId


class OpenTabsContextProvider(ContextProvider):
    """Type '@open' to reference the open tabs in the IDE."""

    title = "open"
    display_title = "Open Tabs"
    description = "Open tabs in the IDE"
    dynamic = True

    def _open_tabs_context_item(self, content: str = ""):
        return ContextItem(
            content=content,
            description=ContextItemDescription(
                name="Open Tabs",
                description="Open tabs in the IDE",
                id=ContextItemId(provider_title=self.title, item_id=self.title),
            ),
        )

    async def get_chat_message(self, item: ContextItem) -> ChatMessage:
        msg = await super().get_chat_message(item)
        msg.content = await self.get_contents()
        msg.summary = msg.content[-1000:]
        return msg

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        return [self._open_tabs_context_item()]

    async def get_contents(self) -> str:
        open_files = await self.ide.getOpenFiles()
        contents = ""
        for file in open_files:
            contents += f"{os.path.basename(file)}\n```\n"
            contents += await self.ide.readFile(file) + "\n```\n\n"

        return contents

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        contents = await self.get_contents()
        return self._open_tabs_context_item(contents)
